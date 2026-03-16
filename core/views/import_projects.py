from io import BytesIO
import openpyxl
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

from django.db import transaction
from django.http import HttpResponse
from django.conf import settings

from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django.views.decorators.csrf import csrf_exempt

from core.models import (
    User, Project, ProjectState, University, 
    College, Department, City, Branch, Role, Staff, Program, Student
)

# ==========================================================
# Header Mapping
# ==========================================================

AR_HEADER_MAP = {
    "عنوان المشروع": "title",
    "الملخص": "description",
    "الحالة": "state",
    "اسم المشرف": "supervisor_first_name",         # Removed "First Name"
    "لقب المشرف": "supervisor_last_name",          # Removed "Last Name"
    "الرقم الوطني للمشرف": "supervisor_cid",        # Removed "National Number"
    "هاتف المشرف": "supervisor_phone",
    "إيميل المشرف": "supervisor_email",
    "مؤهل المشرف": "supervisor_qualification",
    "جنس المشرف": "supervisor_gender",
    "اسم المشرف المشارك": "co_first_name",
    "لقب المشرف المشارك": "co_last_name",
    "الرقم الوطني للمشارك": "co_cid",
    "هاتف المشرف المشارك": "co_phone",
    "إيميل المشرف المشارك": "co_email",
    "مؤهل المشرف المشارك": "co_qualification",
    "جنس المشرف المشارك": "co_gender",
    "سنة بداية المشروع": "start_year",  # Changed from "سنة البداية"
    "سنة نهاية المشروع": "end_year",
    "المجال": "field",
    "الأدوات": "tools",
    "نوع المشروع": "project_type",
    "الجامعة": "university",
    "الكلية": "college",
    "القسم": "department",
    "البرنامج": "program",
    "المحافظة": "city",
    "أسماء الطلاب": "students_names",
    "أرقام قيد الطلاب": "students_ids",
    "ارقام هواتف الطلاب": "students_phones",
}
PROJECT_TYPE_MAP = {
    "حكومي": "Governmental",
    "شركات خارجية": "External",
    "مقترح": "Proposed",
}

REQUIRED_KEYS = ["title", "description", "start_year", "university", "college", "department"]

STATE_MAP = {
    "معلق": "Pending",
    "مقبول": "Accepted",
    "محجوز": "Reserved",
    "مكتمل": "Completed",
    "مرفوض": "Rejected",
}

# ==========================================================
# Helpers
# ==========================================================

def _str(v):
    return "" if v is None else str(v).strip()

def _normalize(v):
    return " ".join(_str(v).split())

def _to_int(v):
    if v is None or _str(v) == "":
        return None
    try:
        return int(float(_str(v)))
    except:
        return None

# ==========================================================
# Commit Import Logic
# ==========================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def import_projects_commit(request):
    f = request.FILES.get("file")
    if not f:
        return Response({"detail": "لم يتم رفع ملف"}, status=400)

    rows, file_errors = read_excel_projects(f)
    if file_errors:
        return Response({"errors": file_errors}, status=400)

    errors, valid_rows = validate_project_rows(rows)
    if errors:
        return Response({"message": "لا يمكن الاستيراد بسبب وجود أخطاء", "errors": errors}, status=400)

    created_projects = 0
    updated_projects = 0
    created_users = 0

    supervisor_role, _ = Role.objects.get_or_create(type="Supervisor", defaults={"role_type": "Faculty"})

    with transaction.atomic():
            for excel_row, row in rows:
                # 1. Organization Hierarchy
                uni, _ = University.objects.get_or_create(uname_ar=_normalize(row["university"]))
                
                # --- MODIFIED SECTION ---
                # Get city from Excel, fallback to "المركز الرئيسي" if empty
                city_name = _normalize(row.get("city")) or "المركز الرئيسي"
                city_obj, _ = City.objects.get_or_create(bname_ar=city_name)
                # ------------------------

                branch_obj, _ = Branch.objects.get_or_create(university=uni, city=city_obj)
                col, _ = College.objects.get_or_create(branch=branch_obj, name_ar=_normalize(row["college"]))
                dep, _ = Department.objects.get_or_create(college=col, name=_normalize(row["department"]))
                
            prog_name = _normalize(row.get("program"))
            prog_obj = None
            if prog_name:
                prog_obj, _ = Program.objects.get_or_create(department=dep, p_name=prog_name)

            # 2. Supervisor User
            sup_cid = _str(row.get("supervisor_cid"))
            supervisor_user = None
            if sup_cid:
                full_name = f"{_str(row.get('supervisor_first_name'))} {_str(row.get('supervisor_last_name'))}".strip()
                supervisor_user, user_created = User.objects.get_or_create(
                    username=sup_cid,
                    defaults={
                        "CID": sup_cid,
                        "name": full_name,
                        "phone": _str(row.get("supervisor_phone")),
                        "gender": _normalize(row.get("supervisor_gender")),
                        "email": _str(row.get("supervisor_email")),
                    }
                )
                if user_created:
                    supervisor_user.set_password("123456")
                    supervisor_user.save()
                    created_users += 1

                Staff.objects.get_or_create(
                    user=supervisor_user,
                    defaults={"role": supervisor_role, "Qualification": _str(row.get("supervisor_qualification"))}
                )

            # 3. Project State & Type
            state_name = _normalize(row.get("state"))
            state_obj, _ = ProjectState.objects.get_or_create(name=STATE_MAP.get(state_name, "Pending"))

            # Get the project type from excel, default to 'Proposed' if not found or empty
            raw_type = _normalize(row.get("project_type"))
            db_project_type = PROJECT_TYPE_MAP.get(raw_type, 'Proposed') 

            # 4. Project Creation
            p, project_created = Project.objects.update_or_create(
                title=_normalize(row["title"]),
                defaults={
                    "project_type": db_project_type,  # <-- Added this
                    "description": _str(row.get("description")),
                    "start_date": _to_int(row.get("start_year")),
                    "end_date": _to_int(row.get("end_year")),
                    "field": _str(row.get("field")),
                    "tools": _str(row.get("tools")),
                    "state": state_obj,
                    "department": dep,
                    "program": prog_obj,
                    "created_by": supervisor_user,
                }
            )

            # 5. Students Processing (Names, IDs, Phones)
            s_names = [_normalize(x) for x in _str(row.get("students_names")).split(",") if _normalize(x)]
            s_ids = [_normalize(x) for x in _str(row.get("students_ids")).split(",") if _normalize(x)]
            s_phones = [_normalize(x) for x in _str(row.get("students_phones")).split(",") if _normalize(x)]

            for i, name in enumerate(s_names):
                sid = s_ids[i] if i < len(s_ids) else None
                sphone = s_phones[i] if i < len(s_phones) else None
                
                # Use Student ID as username if available, otherwise name-based
                s_username = sid if sid else f"std_{p.id}_{i}"
                s_user, s_user_created = User.objects.get_or_create(
                    username=s_username,
                    defaults={"name": name, "phone": sphone}
                )
                if s_user_created:
                    s_user.set_password("123456")
                    s_user.save()
                    created_users += 1

                Student.objects.update_or_create(
                    user=s_user,
                    defaults={
                        "student_id": sid,
                        "phone": sphone,
                        "university": uni,
                        "college": col,
                        "department": dep,
                        "program": prog_obj,
                        "status": 'active'
                    }
                )

            if project_created: created_projects += 1
            else: updated_projects += 1

    return Response({
        "message": "تم الاستيراد بنجاح 🎉",
        "created_projects": created_projects,
        "updated_projects": updated_projects,
        "users_created": created_users
    })
# ==========================================================
# VALIDATION API
# ==========================================================

@csrf_exempt
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def import_projects_validate(request):
    f = request.FILES.get("file")

    if not f:
        return Response({"detail": "لم يتم رفع ملف"}, status=400)

    rows, file_errors = read_excel_projects(f)

    if file_errors:
        return Response({
            "errors": file_errors,
            "valid_rows": 0,
            "invalid_rows": 0
        })

    errors, valid_rows = validate_project_rows(rows)

    return Response({
        "total_rows": len(rows),
        "valid_rows": valid_rows,
        "invalid_rows": len(errors),
        "errors": errors
    })

# ==========================================================
# EXCEL TEMPLATE GENERATOR (LOGO & DOCUMENTATION REMOVED)
# ==========================================================

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def import_projects_template(request):
    # ... (Pre-fill logic remains the same) ...
    pre_city = request.GET.get("pre_city_name") or "صنعاء"
    pre_uni = request.GET.get("pre_university_name") or "جامعة صنعاء"
    pre_coll = request.GET.get("pre_college_name") or "كلية الحاسوب"
    pre_dept = request.GET.get("pre_department_name") or "علوم الحاسوب"
    pre_prog = request.GET.get("pre_program_name") or "تكنولوجيا المعلومات"

    wb = Workbook()
    ws = wb.active
    ws.title = "Projects"
    ws.sheet_view.rightToLeft = True

    headers = list(AR_HEADER_MAP.keys())
    num_cols = len(headers)
    last_col = get_column_letter(num_cols)
    
    # Define our Brand Color
    brand_color = "FF312583"

    # ==========================================================
    # ROW 1: TITLE (COLOR: 312583, TEXT: WHITE, HEIGHT: 40)
    # ==========================================================
    ws.merge_cells(f'A1:{last_col}1')
    title_cell = ws['A1']
    title_cell.value = "قالب استيراد بيانات المشاريع والطلاب"
    title_cell.font = Font(name='Arial', bold=True, size=16, color="FFFFFFFF")
    title_cell.fill = PatternFill(start_color=brand_color, end_color=brand_color, fill_type="solid")
    title_cell.alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 40

    # ==========================================================
# ==========================================================
    # ROW 2: HEADERS (TRANSPARENT BACKGROUND, BRAND TEXT)
    # ==========================================================
    ws.row_dimensions[2].height = 30 
    
    # Change text color to the brand color (312583) since background is now white
    header_font = Font(name='Arial', bold=True, size=12, color="312583")
    
    # Set fill_type to None for transparency
    header_fill = PatternFill(fill_type=None) 
    
    header_alignment = Alignment(horizontal='center', vertical='center')
    
    # Use the brand color for borders so the "transparent" cells have structure
    header_border = Border(
        left=Side(style='thin', color='312583'), 
        right=Side(style='thin', color='312583'), 
        top=Side(style='thin', color='312583'), 
        bottom=Side(style='thin', color='312583')
    )

    for col, header_text in enumerate(headers, start=1):
        cell = ws.cell(row=2, column=col, value=header_text)
        cell.font = header_font
        cell.fill = header_fill # This is now transparent
        cell.alignment = header_alignment
        cell.border = header_border
        ws.column_dimensions[get_column_letter(col)].width = 25

    headers = list(AR_HEADER_MAP.keys()) # This will now include the longer names automatically

    # ROW 3: EXAMPLE DATA
    example_data = [
            "مقترح",                      # <--- Value for "نوع المشروع"
            "نظام إدارة المكتبة",         # title
            "مشروع لإدارة الكتب",         # description
            "معلق",                       # state
            "محمد", "أحمد", "123456789", "777777777", "sup@test.com", "دكتوراه", "ذكر",
            "", "", "", "", "", "", "", 
            2023, 2026, 
            "الذكاء الاصطناعي", "Python, Django", 
            pre_uni, pre_coll, pre_dept, pre_prog, 
            "أحمد علي, خالد محمد", "2020101, 2020102", "771234567, 770000000"
        ]

    # Standard border for data cells
    data_border = Border(
        left=Side(style='thin', color='312583'), 
        right=Side(style='thin', color='312583'), 
        top=Side(style='thin', color='312583'), 
        bottom=Side(style='thin', color='312583')
    )

    for col, value in enumerate(example_data, start=1):
        cell = ws.cell(row=3, column=col, value=value)
        cell.alignment = Alignment(horizontal='right')
        cell.border = data_border

    # ==========================================================
    # GENERATE RESPONSE
    # ==========================================================
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    response = HttpResponse(output.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    response["Content-Disposition"] = 'attachment; filename="projects_template.xlsx"'
    return response