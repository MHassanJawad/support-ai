# Roles and Permissions

| Role | Permissions |
| --- | --- |
| Owner | Manage business, documents, FAQs, conversations, analytics, and members. |
| Admin | Manage documents, FAQs, conversations, and analytics. |
| Member | View dashboard data and conversations. |

The first business creator becomes owner. Owner/admin middleware protects business
profile, document and FAQ mutations. Members can read workspace data.
Migration 003 removes direct browser mutation policies for FAQs, conversations and
messages; writes go through API authorization. Member management UI is not implemented.

Customers can browse public business profiles/FAQs. Sending chat messages and reading
customer conversation history require authentication. Every customer conversation
lookup verifies both business ID and the authenticated customer ID. Knowing another
conversation UUID does not grant access.
