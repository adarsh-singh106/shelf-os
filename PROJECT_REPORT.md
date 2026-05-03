# PROJECT REPORT: ShelfOS - Advanced Library Management System

## 1. Project Overview
**ShelfOS** is a modern, full-stack Library Management System (LMS) designed to streamline the operations of a library. It provides a seamless interface for members to discover, request, and manage books, while offering robust administrative tools for inventory management, borrow confirmation, and fine tracking.

The system is built with a focus on **Database Integrity**, **Security**, and **User Experience**, utilizing a cloud-native architecture.

---

## 2. Objectives
*   To automate the manual process of book issuing and returning.
*   To maintain a normalized database of books, authors, publishers, and members.
*   To enforce library business rules (borrow limits, fine calculation) at the database level.
*   To provide real-time availability tracking and automated waitlist management.
*   To implement a secure, role-based access control system.

---

## 3. Technical Stack
*   **Frontend:** React (TypeScript), Tailwind CSS, Lucide React (Icons).
*   **Backend/Database:** Supabase (PostgreSQL).
*   **State Management:** TanStack Query (React Query).
*   **Authentication:** Supabase Auth (JWT based).
*   **Deployment:** Cloud-ready architecture.

---

## 4. Database Schema Design (DBMS Core)
The database is designed following **Third Normal Form (3NF)** principles to ensure data consistency and eliminate redundancy.

### 4.1 Core Tables
*   **`users`**: Stores member and staff profiles, roles (Admin/Member), and membership tier links.
*   **`membership_tiers`**: Defines borrow limits (e.g., 5 for Students, 10 for Faculty) and daily fine rates.
*   **`books`**: Core catalog information including ISBN, format, and publisher links.
*   **`publishers`**: Normalized table for publishing house details.
*   **`authors` & `book_authors`**: Many-to-Many relationship tracking authors per book.
*   **`genres` & `book_genres`**: Categorization system for library search.
*   **`book_copies`**: Tracks individual physical copies and their status (`available`, `borrowed`, `lost`).
*   **`borrow_history`**: Central transaction table tracking requests, active borrows, due dates, and fine amounts.
*   **`waitlist`**: Automated queue for books with zero available copies.
*   **`audit_log`**: System-wide change tracking for security and accountability.

---

## 5. System Architecture & Features

### 5.1 Member Module
*   **Discovery:** Advanced search by title, author, genre, or ISBN.
*   **Borrowing Workflow:** Single-click "Request" system. Logic checks for:
    *   Unpaid fines.
    *   Membership borrow limits.
    *   Duplicate active requests.
*   **Personal Shelf:** Real-time tracking of active borrows, return history, and waitlist positions.
*   **Waitlist:** Automatic queuing when books are unavailable.

### 5.2 Administrative Module
*   **Inventory Management:** ISBN-based autofill (via OpenLibrary API) to add new books, authors, and publishers.
*   **Request Fulfillment:** Dashboard to confirm or deny member borrow requests.
*   **Audit Logging:** Comprehensive view of all database modifications.
*   **Analytics:** Visual insights into trending books and genre distributions.

---

## 6. Advanced SQL Implementation
This project demonstrates high-level DBMS concepts through:

*   **Stored Procedures (RPCs):** Complex business logic like `request_borrow` and `return_book` are handled inside the database using PL/pgSQL to ensure **ACID compliance**.
*   **Triggers:** Automated status updates and waitlist maintenance.
*   **Row-Level Security (RLS):** Policies that ensure members can only see their own data while admins have global access.
*   **Views:** Complex joins pre-computed as views (`book_details`, `trending_books`) for high-performance data retrieval.

---

## 7. Business Logic & Constraints
*   **Fine Calculation:** `Fine = (Current_Date - Due_Date) * Tier_Rate`. Calculated automatically on return.
*   **Borrow Limits:** Enforced via `membership_tiers` table; dynamic per user role.
*   **Availability Check:** A book cannot be requested if `available_copies` is 0; the user is prompted to join the waitlist instead.

---

## 8. Conclusion
**ShelfOS** successfully demonstrates the application of modern database management principles in a real-world scenario. By moving business logic into the database layer (via RPCs and RLS), the system achieves a level of security and data integrity suitable for production-grade library environments.
