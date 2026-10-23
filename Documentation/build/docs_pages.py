"""07_Pages.docx: every page and main window with its screenshot and what each part does."""

from pathlib import Path

from docx.shared import Cm

from docstyle import bullets, contents, image, new_document, para

# (group, [(page title, screenshot, caption, parts)])
PAGES = [
    (
        "Signing in",
        [
            (
                "Sign-in page",
                "01-sign-in",
                "Sign in to Task Manager",
                [
                    "Left: the app's name and promise, with a small moving board.",
                    "**Continue with Google**, then email and password with **Sign in**.",
                    "**Forgot password?**, **Continue as guest**, **Create an account** and the **Privacy policy** link.",
                    "**العربية** at the top switches the page to Arabic.",
                ],
            ),
            (
                "Create your account",
                "02-create-account",
                "Sign-up form",
                [
                    "Email, password and repeat password; the eye button shows the password.",
                    "The strength bar shows Weak, Medium or Strong; Weak passwords are refused.",
                ],
            ),
            (
                "Check your inbox",
                "03-check-your-inbox",
                "After sign-up",
                [
                    "Says where the confirmation link was sent and that it works for 24 hours.",
                    "**Resend email** sends a new link; **Sign up again** fixes a wrong address.",
                    "The email usually lands in Spam or Junk.",
                ],
            ),
            (
                "Board invitation",
                "26-invitation",
                "Opening an invitation link",
                [
                    "Shows who invited you and to which board, and which email the invitation is for.",
                    "**Accept invitation** adds you to the board.",
                ],
            ),
            (
                "Privacy policy",
                "38-privacy",
                "The public privacy page at /privacy",
                [
                    "What the app keeps, Google sign-in, how data is used, services, cookies, deleting data and the contact address.",
                ],
            ),
        ],
    ),
    (
        "Start page and boards",
        [
            (
                "Start page (new account)",
                "04-start-page-empty",
                "The first visit",
                [
                    "**New workspace** and **New board** cards explain both choices.",
                    "**What's new** is empty until something happens.",
                ],
            ),
            (
                "Start page",
                "32-start-page",
                "With a workspace and boards",
                [
                    "Left panel: each workspace with **Boards** and **Members** lists, then **New workspace**.",
                    "Middle: boards by workspace, then **Boards without a workspace**; each board shows its progress.",
                ],
            ),
            (
                "Start page with notifications",
                "29-start-page-whats-new",
                "What's new for an invited member",
                [
                    "**What's new** lists invitations and changes to cards assigned to you; **See all notifications** opens the bell.",
                    "**Shared with you** lists boards other people shared.",
                ],
            ),
            (
                "Guest start page",
                "37-guest",
                "A guest account",
                [
                    "The bar at the top says guest boards are removed after 7 days and links to sign-up.",
                ],
            ),
            (
                "New workspace window",
                "05-new-workspace",
                "Creating a workspace",
                [
                    "Workspace name, then one or more boards, each with its columns.",
                    "**Suggest columns with AI** proposes column names from the board names.",
                ],
            ),
            (
                "New board window",
                "06-new-board-templates",
                "Templates",
                [
                    "**Start from**: Blank, Sprint, Bug tracking, Personal, your own templates, or Describe it to AI.",
                    "Board name with a microphone button, and the workspace to put it in.",
                ],
            ),
            (
                "New board with AI",
                "07-new-board-ai",
                "Describe it to AI",
                [
                    "One sentence about the project; **Create with AI** builds the board in up to a minute.",
                ],
            ),
        ],
    ),
    (
        "The board",
        [
            (
                "Board page",
                "09-board",
                "A board",
                [
                    "Top bar: app name, board switcher, **New board**, notifications bell, language, theme and account.",
                    "Board header: title, star, progress bar, **Voice command**, **Focus timer**, **Share**, **Ask AI** and the **...** menu.",
                    "Search box and filters for label, priority and status; **Board** and **List** views.",
                    "Columns with a count and menu; cards show priority, labels, due date, checklist progress and people.",
                ],
            ),
            (
                "Board made by AI",
                "08-board-made-by-ai",
                "Created from one sentence",
                [
                    "Columns and starter cards with priorities, ready to edit.",
                ],
            ),
            (
                "Search",
                "14-search",
                "Searching cards",
                [
                    "Matching cards stay; a line says how many are shown and that drag and drop is paused.",
                ],
            ),
            (
                "Filters",
                "15-filter-priority",
                "Filtering by priority",
                [
                    "Filters combine; **Clear filters** shows everything again.",
                ],
            ),
            (
                "List view",
                "16-list-view",
                "Cards as a table",
                [
                    "Title, column, priority, due date, people, labels and status; click a header to sort.",
                ],
            ),
            (
                "Board options menu",
                "20-board-options",
                "The ... menu",
                [
                    "Members, Activity, Change background, Keyboard shortcuts, Archived cards and columns, Duplicate board, "
                    "Save as template, Download CSV (Excel), Download JSON, Move to workspace, Auto-complete, Archive board, Delete board.",
                ],
            ),
        ],
    ),
    (
        "Card and board windows",
        [
            (
                "Card window",
                "10-card-details",
                "Inside a card",
                [
                    "Left: title, description (Write and Preview), checklist with **Suggest steps**, attachments, comments and history.",
                    "Right: **Mark complete**, priority, due date, labels, people, **Duplicate**, **Archive** and **Delete card**.",
                ],
            ),
            (
                "Attachments",
                "11-card-attachments",
                "A file on a card",
                [
                    "Each file with its size, a delete button and, for images, **Make cover**; usage against the account limit.",
                ],
            ),
            (
                "Comments",
                "12-card-comments",
                "Comments",
                [
                    "Write a comment, type @ to mention a member; edit or delete your own comments.",
                ],
            ),
            (
                "Suggested steps",
                "13-ai-checklist",
                "AI checklist suggestions",
                [
                    "Tick the steps to keep, then **Add steps** or **Discard**.",
                ],
            ),
            (
                "AI assistant",
                "17-ai-assistant",
                "The chat panel",
                [
                    "Messages, proposed changes with **Confirm** and **Dismiss**, a microphone and **Clear chat**.",
                ],
            ),
            (
                "Voice command",
                "18-voice-command",
                "Speaking or typing a command",
                [
                    "The heard command is shown with **Confirm** and **Cancel**; **What can I say?** lists commands.",
                ],
            ),
            (
                "Focus timer",
                "19-focus-timer",
                "The focus timer",
                [
                    "25/5 or 50/10, a card to focus on, the countdown and its buttons, sound and desktop notification options.",
                ],
            ),
            (
                "Board background",
                "21-background",
                "Background picker",
                [
                    "Six color presets, **Upload a photo** and **Remove background**.",
                ],
            ),
            ("Activity", "22-activity", "Board activity", ["Every change on the board, newest first."]),
            ("Archived cards and columns", "23-archive", "Archive", ["Restore or delete archived cards and columns."]),
            ("Keyboard shortcuts", "24-keyboard-shortcuts", "Shortcuts", ["N, /, ?, Esc and the keys for moving cards."]),
        ],
    ),
    (
        "Sharing",
        [
            (
                "Members and sharing",
                "25-share-and-members",
                "The Share window",
                [
                    "Invite by email, the invitation link with **Copy link** and **Share on WhatsApp**, members and pending invitations.",
                    "**Public link** and **Meeting link** sections.",
                ],
            ),
            (
                "Member permissions",
                "27-member-permissions",
                "Changing a permission",
                [
                    "Viewer, Can update tasks or Full access for each member; **Remove** takes them off the board.",
                ],
            ),
            ("Assigning a card", "28-assign-card", "Assigned to", ["Tick members to assign the card."]),
            ("Notifications", "30-notifications", "The bell", ["Unread notifications; click one to open its card; **Mark all as read**."]),
            (
                "Public board",
                "31-public-board",
                "Read-only public page",
                [
                    "Anyone with the link sees the board; **Sign in to join** or **Join board** adds them as Viewer.",
                ],
            ),
        ],
    ),
    (
        "Account, theme, language and phone",
        [
            (
                "Account menu",
                "33-account-menu",
                "Account",
                [
                    "Change password, email notifications on or off, sign out and delete account.",
                ],
            ),
            ("Dark mode", "34-dark-mode", "Dark theme", ["Every page has a dark theme."]),
            ("Arabic", "35-arabic", "Arabic, right to left", ["The whole app mirrors for Arabic."]),
            ("Phone", "36-phone", "On a phone", ["Columns stack, buttons wrap, and every control is large enough to tap."]),
        ],
    ),
]


def build(out: Path) -> None:
    doc = new_document("Task Manager", "Pages and windows")
    para(doc, "Every page and main window of the app, as it looks on a desktop in the light theme, with phone and Arabic examples at the end.")
    contents(doc)
    for group, pages in PAGES:
        doc.add_heading(group, level=1)
        for title, shot, caption, parts in pages:
            doc.add_heading(title, level=2)
            image(doc, shot, caption, width=Cm(6.5) if shot == "36-phone" else Cm(15))
            bullets(doc, parts)
    doc.save(str(out))
