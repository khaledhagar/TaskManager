"""Arabic board templates, the same shape as the English ones. `due` is a day offset."""

AR_COLUMNS = ("المطلوب", "قيد التنفيذ", "تم")

AR_TEMPLATES: dict[str, dict] = {
    "blank": {
        "title": "لوحة بدون عنوان",
        "labels": [],
        "columns": [{"title": t, "cards": []} for t in AR_COLUMNS],
    },
    "demo": {
        "title": "إطلاق الموقع",
        "labels": [
            ("التصميم", "purple"),
            ("الواجهة", "blue"),
            ("الخادم", "green"),
            ("التسويق", "orange"),
            ("خلل", "red"),
        ],
        "columns": [
            {
                "title": "المطلوب",
                "cards": [
                    {
                        "title": "كتابة إعلان الإطلاق",
                        "details": "مقال في المدونة ونصوص لوسائل التواصل **ليوم الإطلاق**.",
                        "priority": "medium",
                        "due": 5,
                        "labels": ["التسويق"],
                    },
                    {
                        "title": "إعداد التحليلات",
                        "details": "تتبع التسجيلات والتفعيل والاحتفاظ بالمستخدمين.",
                        "priority": "low",
                        "labels": ["الواجهة"],
                    },
                    {
                        "title": "إصلاح انتهاء مهلة الدفع على الشبكات البطيئة",
                        "details": "أبلغ عنه مستخدمو النسخة التجريبية على الجوال.",
                        "priority": "urgent",
                        "due": -2,
                        "labels": ["خلل", "الخادم"],
                    },
                ],
            },
            {
                "title": "قيد التنفيذ",
                "cards": [
                    {
                        "title": "تصميم صفحة الأسعار",
                        "details": "ثلاث باقات مع جدول لمقارنة المزايا.",
                        "priority": "high",
                        "due": 1,
                        "labels": ["التصميم"],
                        "checklist": [
                            ("رسم المخطط الأولي", True),
                            ("اختيار ألوان مميزة", True),
                            ("مراجعة النصوص مع التسويق", False),
                            ("التسليم لفريق الواجهة", False),
                        ],
                    },
                    {
                        "title": "بناء واجهة التسجيل البرمجية",
                        "details": "البريد الإلكتروني وكلمة المرور، مع تحديد معدل الطلبات.",
                        "priority": "high",
                        "due": 3,
                        "labels": ["الخادم"],
                    },
                ],
            },
            {
                "title": "تم",
                "cards": [
                    {
                        "title": "اختيار ألوان العلامة",
                        "details": "كحلي وأزرق وبنفسجي مع لمسة صفراء.",
                        "priority": "medium",
                        "completed": True,
                        "labels": ["التصميم"],
                    },
                    {"title": "تسجيل النطاق", "priority": "low", "completed": True},
                ],
            },
        ],
    },
    "sprint": {
        "title": "لوحة السباق",
        "labels": [("ميزة", "blue"), ("خلل", "red"), ("مهمة روتينية", "gray")],
        "columns": [
            {
                "title": "المهام المؤجلة",
                "cards": [
                    {
                        "title": "تجهيز قصص السباق القادم",
                        "priority": "medium",
                        "labels": ["مهمة روتينية"],
                    }
                ],
            },
            {
                "title": "المطلوب",
                "cards": [{"title": "تحديد هدف السباق", "priority": "high", "due": 1}],
            },
            {"title": "قيد التنفيذ", "cards": []},
            {"title": "المراجعة", "cards": []},
            {"title": "تم", "cards": []},
        ],
    },
    "bug_tracking": {
        "title": "متتبع الأخطاء",
        "labels": [("حرج", "red"), ("الواجهة", "purple"), ("API", "green")],
        "columns": [
            {
                "title": "تم الإبلاغ",
                "cards": [
                    {
                        "title": "مثال: زر غير محاذٍ على الجوال",
                        "details": "خطوات إعادة المشكلة، والنتيجة المتوقعة والفعلية.",
                        "priority": "low",
                        "labels": ["الواجهة"],
                    }
                ],
            },
            {"title": "تم الفرز", "cards": []},
            {"title": "قيد الإصلاح", "cards": []},
            {"title": "تم التحقق", "cards": []},
        ],
    },
    "personal": {
        "title": "شخصي",
        "labels": [("المنزل", "green"), ("الصحة", "blue"), ("مشاوير", "yellow")],
        "columns": [
            {
                "title": "يوما ما",
                "cards": [{"title": "التخطيط لرحلة نهاية الأسبوع", "priority": "low"}],
            },
            {
                "title": "هذا الأسبوع",
                "cards": [
                    {
                        "title": "حجز موعد طبيب الأسنان",
                        "priority": "medium",
                        "due": 4,
                        "labels": ["الصحة"],
                    }
                ],
            },
            {
                "title": "اليوم",
                "cards": [
                    {
                        "title": "شراء البقالة",
                        "priority": "medium",
                        "due": 0,
                        "labels": ["مشاوير"],
                        "checklist": [("حليب", False), ("خبز", False), ("قهوة", False)],
                    }
                ],
            },
            {"title": "تم", "cards": []},
        ],
    },
}
