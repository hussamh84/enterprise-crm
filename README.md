# Enterprise SaaS CRM (CCTV / Networking / Solar)

Production-style modular CRM platform with multi-tenant architecture, RBAC, and enterprise module foundations.

## Stack

- Frontend: React + Vite + Tailwind + Zustand + React Query
- Backend: Node.js + Express + MongoDB + Mongoose

## Architecture

- Layered backend structure (`controllers/services/repositories` pattern represented via module routers + shared repository logic)
- Multi-tenant isolation (`tenantId` in every business document)
- Auth + JWT + role-based access support
- Soft delete + audit log fields on core entities
- Modular APIs for:
  - Leads pipeline
  - Clients
  - Activities
  - Site visits
  - Quotations
  - Projects
  - Invoices
  - Payments
  - Inventory
  - Support tickets
  - Dashboard KPIs
  - Global search

## Run Locally

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

## Default setup flow

1. Register a company admin:
   - `POST /api/v1/auth/register`
   - Example body:
```json
{
  "fullName": "Admin User",
  "email": "admin@demo.com",
  "password": "Password123!",
  "tenantId": "demo-company",
  "role": "company_admin"
}
```
2. Login from UI with the same credentials.

## Notes on enterprise roadmap

This implementation delivers a full working baseline with the requested modules and enterprise structure.  
For Salesforce/Zoho-level parity, next steps are:

- Per-module granular permissions matrix (CRUD per module per role)
- Drag-drop dashboard/widget persistence
- Full quotation/invoice PDF template engine
- Advanced report builder and workflow designer UI
- Background jobs, queue workers, and event bus
- File storage service (S3/Azure Blob) and image processing
- Observability stack (metrics, tracing, audit exports)
