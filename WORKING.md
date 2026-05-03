# USER GUIDE: How ShelfOS Works (Real-World Scenarios)

This guide walks you through the lifecycle of a book within **ShelfOS**, from discovery to return, demonstrating how our DBMS-level logic handles real-world library scenarios.

---

## Scenario 1: Onboarding & Membership Tiers
When a user signs up, they are assigned a **Membership Tier** (default: *Student*).
*   **DBMS Feature:** The `membership_tiers` table defines that a *Student* can only have **5 active borrows** at a time and has a **₹5/day fine** for late returns.
*   **Real-World Impact:** This ensures the library's physical inventory is shared fairly among the student body.

---

## Scenario 2: Smart Book Discovery
A student searches for "The Great Gatsby".
*   **Application Feature:** The search bar queries the `book_details` view, which instantly pulls data across `books`, `authors`, and `genres`.
*   **Real-World Impact:** The user sees real-time availability (e.g., "3 of 5 copies available") before they even click the book.

---

## Scenario 3: Requesting a Book (The Transaction)
The student clicks **"Request Borrow"**.
*   **DBMS Logic (Stored Procedure):** The `request_borrow` RPC runs several checks:
    1.  **Debt Check:** Does the user have unpaid fines? (Blocked if yes).
    2.  **Limit Check:** Does the user already have 5 books? (Blocked if yes).
    3.  **Duplicate Check:** Are they already requesting this exact book? (Blocked if yes).
*   **Result:** If all pass, a record is created in `borrow_history` with the status `requested`.
*   **Librarian Action:** The Librarian sees this in their "Admin Requests" dashboard and clicks **"Confirm"**. This automatically assigns a specific `copy_id` and sets the `due_date` to exactly 14 days from now.

---

## Scenario 4: The Waitlist (Handling Zero Inventory)
What if "The Great Gatsby" has **0 copies** available?
*   **Application Feature:** The "Request" button changes to **"Join Waitlist"**.
*   **DBMS Logic:** The user is added to the `waitlist` table.
*   **Real-World Impact:** In the "My Shelf" page, the student sees their position (e.g., "#2 in queue"). When a copy is returned, the librarian can easily see who is next in line.

---

## Scenario 5: Returning a Book & Fine Calculation
The student returns the book **2 days after the due date**.
*   **DBMS Logic (Stored Procedure):** When the Librarian clicks "Return", the `return_book` RPC calculates:
    *   `Overdue Days` = 2
    *   `Fine Rate` = ₹5 (Student Tier)
    *   `Total Fine` = ₹10
*   **Result:** The book status changes to `returned`, but a `fine_amount` of ₹10 is recorded, and `fine_status` is set to `unpaid`.
*   **Real-World Impact:** The student can no longer borrow any other books until they pay this ₹10 fine at the counter.

---

## Scenario 6: Administrative Oversight (Audit Logs)
An Admin wants to know who added a new book or modified a record.
*   **DBMS Feature:** Every change to the database is captured by a trigger and stored in the `audit_log`.
*   **Application Feature:** The "Admin Audit Log" page displays a JSON-diff of the `old_data` vs `new_data`.
*   **Real-World Impact:** Prevents "ghost" changes and ensures complete accountability for the library staff.

---

## Summary of Logic Flow
1.  **Discovery:** User searches -> View filtered.
2.  **Validation:** Request clicked -> RPC checks constraints.
3.  **Fulfillment:** Librarian confirms -> Copy status updated + Due date set.
4.  **Completion:** Book returned -> RPC calculates fine + History archived.
