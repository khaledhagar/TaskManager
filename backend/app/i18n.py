"""Request language (from Accept-Language) and Arabic translations of server messages."""

from contextvars import ContextVar
from typing import Literal

from fastapi import FastAPI, Request

Language = Literal["en", "ar"]

_language: ContextVar[Language] = ContextVar("language", default="en")

AR: dict[str, str] = {
    "Not found": "غير موجود",
    "Not signed in": "لم تسجل الدخول",
    "Email already registered": "هذا البريد الإلكتروني مسجل بالفعل",
    "Invalid email or password": "البريد الإلكتروني أو كلمة المرور غير صحيحة",
    "Please verify your email first. We can send a new link.": (
        "يرجى تأكيد بريدك الإلكتروني أولا. يمكننا إرسال رابط جديد."
    ),
    "Account is not a guest account": "هذا الحساب ليس حساب ضيف",
    "This link is invalid or has expired. Please request a new one.": (
        "هذا الرابط غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد."
    ),
    "If an account needs verification, we sent a new link.": (
        "إذا كان الحساب يحتاج إلى تأكيد، فقد أرسلنا رابطا جديدا."
    ),
    "If an account exists for this email, we sent a reset link.": (
        "إذا كان هناك حساب بهذا البريد، فقد أرسلنا رابط إعادة التعيين."
    ),
    "Current password is incorrect": "كلمة المرور الحالية غير صحيحة",
    (
        "This password is too weak. Use at least 10 characters with letters and numbers, "
        "and avoid common words and your email."
    ): (
        "كلمة المرور هذه ضعيفة جدا. استخدم 10 أحرف على الأقل تجمع بين الحروف والأرقام، "
        "وتجنب الكلمات الشائعة وبريدك الإلكتروني."
    ),
    "Google sign-in is not configured": "تسجيل الدخول بحساب Google غير مُعد",
    "You can only view this board. Ask the board admin for permission to edit.": (
        "يمكنك عرض هذه اللوحة فقط. اطلب من المسؤول عن اللوحة صلاحية التعديل."
    ),
    "Ask the board admin for full access to do this.": (
        "اطلب من المسؤول عن اللوحة صلاحية كاملة لتنفيذ ذلك."
    ),
    "Only the board admin can do this.": "هذا الإجراء متاح للمسؤول عن اللوحة فقط.",
    "The board admin's role cannot be changed.": "لا يمكن تغيير دور المسؤول عن اللوحة.",
    "The board admin cannot leave the board.": "لا يمكن للمسؤول عن اللوحة مغادرتها.",
    "You already have full access to this board.": "لديك بالفعل صلاحية كاملة على هذه اللوحة.",
    "Create an account to share this board.": "أنشئ حسابا لمشاركة هذه اللوحة.",
    "Create an account to join this board.": "أنشئ حسابا للانضمام إلى هذه اللوحة.",
    "Add a meeting link first.": "أضف رابط الاجتماع أولا.",
    "This link is invalid.": "هذا الرابط غير صالح.",
    "You can only change your own comments.": "يمكنك تعديل تعليقاتك فقط.",
    "Only the author or the board admin can delete this comment.": (
        "لا يحذف هذا التعليق إلا كاتبه أو المسؤول عن اللوحة."
    ),
    "This person is already a member of this board.": "هذا الشخص عضو بالفعل في هذه اللوحة.",
    "Limit reached: at most {cap} pending invitations per board": (
        "تم بلوغ الحد: {cap} دعوة معلقة كحد أقصى لكل لوحة"
    ),
    "Limit reached: at most {cap} members per board": "تم بلوغ الحد: {cap} عضو كحد أقصى لكل لوحة",
    "This invitation link is invalid or has expired.": (
        "رابط الدعوة هذا غير صالح أو منتهي الصلاحية."
    ),
    "Create an account or sign in with {email} to accept this invitation.": (
        "أنشئ حسابا أو سجّل الدخول باستخدام {email} لقبول هذه الدعوة."
    ),
    "This invitation was sent to {email}. Sign in with that address to accept it.": (
        "أُرسلت هذه الدعوة إلى {email}. سجّل الدخول بهذا العنوان لقبولها."
    ),
    "Cross-site request blocked": "تم حظر طلب من موقع آخر",
    "Order must list every column once": "يجب أن يتضمن الترتيب كل عمود مرة واحدة",
    "Limit reached: at most {cap} boards": "تم بلوغ الحد: {cap} لوحة كحد أقصى",
    "Limit reached: at most {cap} templates": "تم بلوغ الحد: {cap} قالب كحد أقصى",
    "Limit reached: at most {cap} workspaces": "تم بلوغ الحد: {cap} مساحة عمل كحد أقصى",
    " (copy)": " (نسخة)",
    "Only an image can be a cover": "يمكن استخدام صورة فقط كغلاف",
    "Limit reached: at most {cap} columns per board": "تم بلوغ الحد: {cap} عمود كحد أقصى لكل لوحة",
    "Maximum cards in a board is {cap}. Delete a card to add a new one.": (
        "الحد الأقصى للبطاقات في اللوحة هو {cap} بطاقة. احذف بطاقة لإضافة بطاقة جديدة."
    ),
    "Limit reached: at most {cap} labels per board": "تم بلوغ الحد: {cap} تصنيف كحد أقصى لكل لوحة",
    "Limit reached: at most {cap} checklist items per card": (
        "تم بلوغ الحد: {cap} عنصر كحد أقصى في قائمة كل بطاقة"
    ),
    "Limit reached: at most {cap} files per card": "تم بلوغ الحد: {cap} ملف كحد أقصى لكل بطاقة",
    "Upload size is required": "حجم الملف المرفوع مطلوب",
    "File is too large. The limit is {mb} MB.": "الملف كبير جدا. الحد الأقصى {mb} م.ب.",
    "Not enough storage left. Your limit is {mb} MB.": (
        "لا توجد مساحة تخزين كافية. الحد المسموح لك {mb} م.ب."
    ),
    "This file is not a valid PDF.": "هذا الملف ليس ملف PDF صالحا.",
    "This file is not plain text.": "هذا الملف ليس نصا عاديا.",
    "Text files must be UTF-8.": "يجب أن تكون الملفات النصية بترميز UTF-8.",
    "This file is not a valid {kind} document.": "هذا الملف ليس مستند {kind} صالحا.",
    "This file type isn't allowed. Allowed types: {types}.": (
        "نوع الملف غير مسموح. الأنواع المسموحة: {types}."
    ),
    "This image is too large in pixels.": "أبعاد هذه الصورة كبيرة جدا.",
    "This file is not a valid image.": "هذا الملف ليس صورة صالحة.",
    "The image content does not match its file extension.": "محتوى الصورة لا يطابق امتداد الملف.",
    "Backgrounds must be JPG, PNG or WebP images.": "يجب أن تكون الخلفية صورة JPG أو PNG أو WebP.",
    "The AI assistant is busy or today's free limit is reached. Please try again later.": (
        "المساعد الذكي مشغول أو تم بلوغ الحد المجاني لهذا اليوم. حاول مرة أخرى لاحقا."
    ),
    "The AI assistant is unavailable right now. Please try again.": (
        "المساعد الذكي غير متاح الآن. حاول مرة أخرى."
    ),
    "The AI assistant returned an unexpected answer. Please try again.": (
        "أعاد المساعد الذكي إجابة غير متوقعة. حاول مرة أخرى."
    ),
    "AI board": "لوحة ذكية",
    "The request is too large.": "الطلب كبير جدا.",
    "Too many attempts. Please wait a moment and try again.": (
        "محاولات كثيرة جدا. انتظر قليلا ثم حاول مرة أخرى."
    ),
    "Too many AI requests. Please wait a minute and try again.": (
        "طلبات كثيرة للذكاء الاصطناعي. انتظر دقيقة ثم حاول مرة أخرى."
    ),
    "You have used today's AI requests. Please try again tomorrow.": (
        "استخدمت طلبات الذكاء الاصطناعي لهذا اليوم. حاول مرة أخرى غدا."
    ),
    "Something went wrong on our side. Please try again.": "حدث خطأ من جهتنا. حاول مرة أخرى.",
}


def pick(header: str | None) -> Language:
    """The language of the first (most preferred) Accept-Language entry; English otherwise."""
    first = (header or "").split(",")[0].split(";")[0].strip().lower()
    return "ar" if first == "ar" or first.startswith("ar-") else "en"


def current_language() -> Language:
    return _language.get()


def tr(text: str, **params: object) -> str:
    """`text` in the request language, with `{name}` fields filled from `params`."""
    if current_language() == "ar":
        text = AR[text]
    return text.format(**params) if params else text


def add_language(app: FastAPI) -> None:
    """Read Accept-Language once per request; added last so it wraps every other middleware."""

    @app.middleware("http")
    async def language(request: Request, call_next):
        token = _language.set(pick(request.headers.get("accept-language")))
        try:
            return await call_next(request)
        finally:
            _language.reset(token)
