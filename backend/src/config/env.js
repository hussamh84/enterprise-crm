const dotenv = require("dotenv");
const { COMPANY } = require("./company");

dotenv.config();

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/enterprise_crm",
  jwtSecret: process.env.JWT_SECRET || "enterprise-crm-secret",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  defaultAdminName: process.env.DEFAULT_ADMIN_NAME || "System Admin",
  defaultAdminEmail: process.env.DEFAULT_ADMIN_EMAIL || "admin@demo.com",
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || "12345678",
  defaultAdminTenantId: process.env.DEFAULT_ADMIN_TENANT_ID || "demo-company",
  companyName: process.env.COMPANY_NAME || COMPANY.name,
  companyEmail: process.env.COMPANY_EMAIL || COMPANY.email,
  companyPhone: process.env.COMPANY_PHONE || COMPANY.phone,
  companyAddress: process.env.COMPANY_ADDRESS || COMPANY.address,
  companyTaxId: process.env.COMPANY_TAX_ID || "TAX-00001",
  companyLogoPath: process.env.COMPANY_LOGO_PATH || "",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: String(process.env.SMTP_SECURE || "false") === "true",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  mailFrom: process.env.MAIL_FROM || process.env.SMTP_USER || "no-reply@localhost",
};
