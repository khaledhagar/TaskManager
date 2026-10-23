"""01_Overview.docx and 02_Documentation.docx: written text about the finished, live app."""

from pathlib import Path

from docstyle import bullets, contents, image, new_document, note_box, para, simple_table

SITE = "https://task-manager-opal-xi-63.vercel.app"

SHORT = (
    "Task Manager is a free Kanban board app for planning work alone or with a team. "
    "It turns a sentence into a ready board with AI and works in English and Arabic on any device."
)

LONG = [
    "Task Manager helps people see their work and move it forward. Each board has columns, such as To Do, "
    "In Progress and Done, and each piece of work is a card that moves from column to column by drag and drop. "
    "A card holds everything about the task: a description written with simple formatting, a checklist, a priority "
    "from Low to Urgent, a due date that turns yellow when it is close and red when it is late, colored labels, "
    "attached files, comments and the people working on it. A progress bar shows how much of the board is done.",
    "Boards can stand alone or be grouped into workspaces, and the start page shows them all, with a short "
    "What's new list of invitations and changes to the cards assigned to you. New boards start empty or from a "
    "template (Sprint, Bug tracking, Personal or your own), and an AI assistant can build a whole board from one "
    "sentence, suggest checklist steps for a card, and answer questions about a board. It can also create, move and "
    "complete cards, but only after the user confirms each change.",
    "Work is easy to share. The board owner invites people by email, a copied link or WhatsApp, and chooses what each "
    "person may do: only view, update tasks, or have full access. A board can also get a public read-only link, a "
    "meeting link for Zoom, Google Meet or Teams, and card assignments that send notifications and emails.",
    "The app is built for everyone. It works in English and in Arabic from right to left, in light and dark themes, "
    "on phones, tablets and computers, and with the keyboard and screen readers. People who prefer to speak can "
    "dictate text and give voice commands. A focus timer helps with focused work, and boards can be searched, "
    "filtered, shown as a list and exported to Excel.",
    "Anyone can start at once as a guest, or create a free account with an email address or with Google. The site is "
    f"live at {SITE}. It keeps data in the European Union, never shows ads or tracks people, and lets every user "
    "delete their account and all their data at any time.",
]

FEATURES = [
    (
        "Boards and cards",
        [
            "Boards with columns that can be added, renamed, reordered by drag and drop, limited (WIP limit), archived and deleted.",
            "Cards with title, Markdown description, checklist, priority, due date, labels, files, comments, people and a cover image.",
            "Drag and drop with the mouse, touch or keyboard; undo after deleting; progress bar; overdue and due-soon colors.",
            "Templates (Blank, Sprint, Bug tracking, Personal and your own), duplicates, stars, archive and auto-complete.",
            "Search, filters (label, priority, status, assigned to me, overdue), list view, and export to CSV (Excel) or JSON.",
            "Keyboard shortcuts: N new card, / search, Esc close, ? help.",
        ],
    ),
    (
        "Workspaces and the start page",
        [
            "Workspaces group related boards; the start page lists workspaces, boards, shared boards and What's new.",
        ],
    ),
    (
        "Sharing and permissions",
        [
            "Invite by email, invitation link or WhatsApp; the board creator is the admin.",
            "Permissions: Viewer (default), Can update tasks, Full access; viewers can request more access.",
            "Assign cards to members; comments with @mentions; board activity log.",
            "Meeting link (Zoom, Google Meet, Teams) with Start meeting and Send the link to members.",
        ],
    ),
    (
        "Public boards",
        [
            "A read-only public link that works without signing in; signed-in visitors can join as Viewer; the admin can turn it off.",
        ],
    ),
    (
        "AI",
        [
            "Describe it to AI: a full board from one sentence. Suggest steps: a checklist for a card.",
            "AI assistant chat about the board and the app; it creates, moves and completes cards only after you click Confirm.",
            "Uses free AI models with a shared daily limit; text goes to the AI service only when an AI button is used.",
        ],
    ),
    (
        "Files",
        [
            "Attachments up to 4 MB each, 10 per card and 100 MB per account (10 MB for guests): images, PDF, text, CSV and Office files.",
            "Board backgrounds: six colors or your own photo (up to 10 MB, resized automatically).",
        ],
    ),
    (
        "Focus timer",
        [
            "Optional Pomodoro timer: 25/5 or 50/10 minutes, linked to a card, with sound and desktop notifications.",
        ],
    ),
    (
        "Notifications",
        [
            "A bell with assignments, mentions, invitations, meetings and due or overdue cards; reminder emails, which can be turned off.",
        ],
    ),
    (
        "Languages, themes and devices",
        [
            "English and Arabic (right to left); emails and AI answers follow the language.",
            "Light and dark themes; phones, tablets, laptops and desktops.",
        ],
    ),
    (
        "Voice",
        [
            'Microphone buttons on the main text fields and the AI chat; voice commands such as "move Buy domain to Done".',
        ],
    ),
    (
        "Accounts and security",
        [
            "Guest accounts (removed after 7 days unless upgraded), email and password with confirmation, Continue with Google.",
            "Forgot password, change or set password, email notification setting, delete account.",
            "Passwords stored only as Argon2 hashes; secure, httpOnly cookies; strict security headers; rate limits; "
            "every request checked so nobody can see another person's boards.",
        ],
    ),
]


def build_overview(out: Path) -> None:
    doc = new_document("Task Manager", "Overview")
    doc.add_heading("Name", level=1)
    para(doc, f"**Task Manager**, live at {SITE}")
    doc.add_heading("Short description", level=1)
    doc.add_paragraph(SHORT)
    image(doc, "09-board", "A board in Task Manager")
    doc.add_heading("Long description", level=1)
    for text in LONG:
        doc.add_paragraph(text)
    doc.save(str(out))


def build_documentation(out: Path) -> None:
    doc = new_document("Task Manager", "Documentation")
    note_box(
        doc,
        "Sign-up emails usually land in Spam or Junk",
        [
            "Tell new users to look in their **Spam** or **Junk** folder for the confirmation email and mark it **Not spam**.",
        ],
    )
    contents(doc)
    doc.add_heading("What the app is for", level=1)
    para(
        doc,
        "Task Manager is a Kanban board app for planning and tracking work: personal to-do lists, school projects, "
        "small team sprints, bug tracking and events. It aims to be calm, fast and simple, with AI help where it saves time.",
    )
    doc.add_heading("Who it is for", level=1)
    bullets(
        doc,
        [
            "**Individuals** who want a clear view of their tasks.",
            "**Small teams, classes and clubs** who share a board and split the work.",
            "**Arabic and English speakers**, including people who prefer a right-to-left layout.",
            "**People who use the keyboard, a screen reader or their voice** instead of a mouse.",
        ],
    )
    doc.add_heading("Features", level=1)
    for area, items in FEATURES:
        doc.add_heading(area, level=2)
        bullets(doc, items)
    doc.add_heading("How to use it", level=1)
    para(
        doc,
        "Open the site, create an account (or continue as a guest), and you land on the start page. Create a board, "
        "add cards, and drag them across the columns as the work moves. Open a card for details, share the board from "
        "**Share**, and use **Ask AI** for help. The step-by-step guide with screenshots is in **README.docx**, the flows "
        "are in **06_User_Flows.docx**, and every page is described in **07_Pages.docx**.",
    )
    doc.add_heading("Limits", level=1)
    simple_table(
        doc,
        ["What", "Limit"],
        [
            ["Cards per board", '100 ("Maximum cards in a board is 100")'],
            ["Files", "4 MB per file, 10 per card, 100 MB per account (guests 10 MB)"],
            ["Background photo", "10 MB, JPG, PNG or WebP"],
            ["Guests", "Removed after 7 days unless upgraded"],
            ["Email links", "Confirmation and reset links work for 24 hours"],
            ["AI", "Free models with a daily limit shared by all users; busy or limited at times"],
            ["Rate limits", "Sign-in, guest creation, emails, uploads and AI calls are limited per person and address"],
        ],
        [5, 12],
    )
    doc.add_heading("Browsers and devices", level=1)
    simple_table(
        doc,
        ["Browser or device", "Support"],
        [
            ["Microsoft Edge, Google Chrome (current versions)", "Everything, including voice input"],
            ["Safari (Mac, iPhone, iPad)", "Everything, including voice input"],
            ["Firefox", "Everything except voice input (Firefox has no speech recognition); the microphone buttons are hidden"],
            ["Phones and tablets", "Full app; columns stack and controls are large enough to tap; touch drag and drop"],
            ["Screen readers and keyboard", "Every control has a label; drag and drop works with the keyboard; WCAG 2.2 AA"],
        ],
        [6, 11],
    )
    doc.save(str(out))
