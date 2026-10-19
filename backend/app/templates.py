"""Board templates as plain data. `due` is a day offset from today."""

DEFAULT_COLUMNS = [{"title": t, "cards": []} for t in ("To Do", "In Progress", "Done")]

TEMPLATES: dict[str, dict] = {
    "blank": {
        "title": "Untitled board",
        "labels": [],
        "columns": DEFAULT_COLUMNS,
    },
    "demo": {
        "title": "Website Launch",
        "labels": [
            ("Design", "purple"),
            ("Frontend", "blue"),
            ("Backend", "green"),
            ("Marketing", "orange"),
            ("Bug", "red"),
        ],
        "columns": [
            {
                "title": "To Do",
                "cards": [
                    {
                        "title": "Write launch announcement",
                        "details": "Blog post and social copy for **launch day**.",
                        "priority": "medium",
                        "due": 5,
                        "labels": ["Marketing"],
                    },
                    {
                        "title": "Set up analytics",
                        "details": "Track sign-ups, activation and retention.",
                        "priority": "low",
                        "labels": ["Frontend"],
                    },
                    {
                        "title": "Fix checkout timeout on slow networks",
                        "details": "Reported by beta users on mobile.",
                        "priority": "urgent",
                        "due": -2,
                        "labels": ["Bug", "Backend"],
                    },
                ],
            },
            {
                "title": "In Progress",
                "cards": [
                    {
                        "title": "Design pricing page",
                        "details": "Three tiers with a feature comparison table.",
                        "priority": "high",
                        "due": 1,
                        "labels": ["Design"],
                        "checklist": [
                            ("Draft wireframe", True),
                            ("Pick color accents", True),
                            ("Review copy with marketing", False),
                            ("Hand off to frontend", False),
                        ],
                    },
                    {
                        "title": "Build sign-up API",
                        "details": "Email and password, with rate limiting.",
                        "priority": "high",
                        "due": 3,
                        "labels": ["Backend"],
                    },
                ],
            },
            {
                "title": "Done",
                "cards": [
                    {
                        "title": "Choose brand colors",
                        "details": "Navy, blue, purple and a yellow accent.",
                        "priority": "medium",
                        "completed": True,
                        "labels": ["Design"],
                    },
                    {"title": "Register domain", "priority": "low", "completed": True},
                ],
            },
        ],
    },
    "sprint": {
        "title": "Sprint board",
        "labels": [("Feature", "blue"), ("Bug", "red"), ("Chore", "gray")],
        "columns": [
            {
                "title": "Backlog",
                "cards": [
                    {
                        "title": "Groom next sprint stories",
                        "priority": "medium",
                        "labels": ["Chore"],
                    }
                ],
            },
            {
                "title": "To Do",
                "cards": [{"title": "Define sprint goal", "priority": "high", "due": 1}],
            },
            {"title": "In Progress", "cards": []},
            {"title": "Review", "cards": []},
            {"title": "Done", "cards": []},
        ],
    },
    "bug_tracking": {
        "title": "Bug tracker",
        "labels": [("Critical", "red"), ("UI", "purple"), ("API", "green")],
        "columns": [
            {
                "title": "Reported",
                "cards": [
                    {
                        "title": "Example: button misaligned on mobile",
                        "details": "Steps to reproduce, expected and actual result.",
                        "priority": "low",
                        "labels": ["UI"],
                    }
                ],
            },
            {"title": "Triaged", "cards": []},
            {"title": "Fixing", "cards": []},
            {"title": "Verified", "cards": []},
        ],
    },
    "personal": {
        "title": "Personal",
        "labels": [("Home", "green"), ("Health", "blue"), ("Errands", "yellow")],
        "columns": [
            {"title": "Someday", "cards": [{"title": "Plan a weekend trip", "priority": "low"}]},
            {
                "title": "This Week",
                "cards": [
                    {
                        "title": "Book dentist appointment",
                        "priority": "medium",
                        "due": 4,
                        "labels": ["Health"],
                    }
                ],
            },
            {
                "title": "Today",
                "cards": [
                    {
                        "title": "Buy groceries",
                        "priority": "medium",
                        "due": 0,
                        "labels": ["Errands"],
                        "checklist": [("Milk", False), ("Bread", False), ("Coffee", False)],
                    }
                ],
            },
            {"title": "Done", "cards": []},
        ],
    },
}

USER_TEMPLATES = ("blank", "sprint", "bug_tracking", "personal")
