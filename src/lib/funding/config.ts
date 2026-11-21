
/**
 * Where funding goes. Every value comes from environment variables set by the
 * NGO; nothing here is invented. Anything missing or malformed is left out, and
 * the page says the details are being added instead of showing a placeholder.
 */

export interface BankDetails {
  accountName: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  branch: string | null;
  accountType: string | null;
}

export interface FundingConfig {
  /** Legal name of the organisation that receives the money. */
  beneficiary: string | null;
  upi: { id: string; payeeName: string } | null;
  bank: BankDetails | null;
  registrations: { label: string; value: string }[];
  contactEmail: string | null;
  /** True when no real details are configured and the clearly labelled sample set is shown. */
  sample: boolean;
}

/**
 * Shown only while no real details are set. Every value is a format example that
 * cannot receive money (the UPI handle and IFSC bank code don't exist), and the page
 * marks the whole panel as a sample with payments switched off.
 */
const SAMPLE_CONFIG: FundingConfig = {
  beneficiary: "Nagrik Civic Repairs Trust (sample)",
  upi: { id: "nagriktrust@sample", payeeName: "Nagrik Civic Repairs Trust" },
  bank: {
    accountName: "Nagrik Civic Repairs Trust",
    accountNumber: "000123456789",
    ifsc: "SMPL0000001",
    bankName: "Sample Bank",
    branch: "Kharghar, Navi Mumbai",
    accountType: "Current account",
  },
  registrations: [
    { label: "PAN", value: "AAATN0000S" },
    { label: "GSTIN", value: "27AAATN0000S1ZS" },
    { label: "CSR-1 registration", value: "CSR00000000" },
    { label: "12A", value: "AAATN0000SE20261" },
    { label: "80G", value: "AAATN0000SF20261" },
  ],
  contactEmail: "funding@example.org",
  sample: true,
};

const env = (k: string) => (process.env[k] || "").trim();

const UPI_RE = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^\d{9,18}$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const CSR1_RE = /^CSR\d{8}$/;
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function clean(text: string, max = 120): string {
  return text.replace(/[\u0000-\u001f<>]/g, "").slice(0, max);
}

export function getFundingConfig(): FundingConfig {
  const beneficiary = clean(env("FUND_BENEFICIARY_NAME")) || null;

  const upiId = env("FUND_UPI_ID");
  const upi =
    UPI_RE.test(upiId) && (env("FUND_UPI_PAYEE_NAME") || beneficiary)
      ? { id: upiId, payeeName: clean(env("FUND_UPI_PAYEE_NAME") || beneficiary || "", 60) }
      : null;

  const accountNumber = env("FUND_BANK_ACCOUNT_NUMBER").replace(/\s+/g, "");
  const ifsc = env("FUND_BANK_IFSC").toUpperCase();
  const accountName = clean(env("FUND_BANK_ACCOUNT_NAME") || beneficiary || "");
  const bankName = clean(env("FUND_BANK_NAME"));
  const bank: BankDetails | null =
    ACCOUNT_RE.test(accountNumber) && IFSC_RE.test(ifsc) && accountName && bankName
      ? {
          accountName,
          accountNumber,
          ifsc,
          bankName,
          branch: clean(env("FUND_BANK_BRANCH")) || null,
          accountType: clean(env("FUND_BANK_ACCOUNT_TYPE"), 30) || null,
        }
      : null;

  const registrations: { label: string; value: string }[] = [];
  const pan = env("FUND_NGO_PAN").toUpperCase();
  if (PAN_RE.test(pan)) registrations.push({ label: "PAN", value: pan });
  const gstin = env("FUND_NGO_GSTIN").toUpperCase();
  if (GSTIN_RE.test(gstin)) registrations.push({ label: "GSTIN", value: gstin });
  const csr1 = env("FUND_NGO_CSR1").toUpperCase();
  if (CSR1_RE.test(csr1)) registrations.push({ label: "CSR-1 registration", value: csr1 });
  const r12a = clean(env("FUND_NGO_12A"), 60);
  if (r12a) registrations.push({ label: "12A", value: r12a });
  const r80g = clean(env("FUND_NGO_80G"), 60);
  if (r80g) registrations.push({ label: "80G", value: r80g });

  const email = env("FUND_CONTACT_EMAIL");

  // Nothing real configured yet: show the labelled sample set (unless FUND_SAMPLE=off).
  if (!upi && !bank) return env("FUND_SAMPLE") === "off" ? { ...SAMPLE_CONFIG, upi: null, bank: null, registrations: [], beneficiary: null, contactEmail: null, sample: false } : SAMPLE_CONFIG;

  return {
    sample: false,
    beneficiary,
    upi,
    bank,
    registrations,
    contactEmail: EMAIL_RE.test(email) && email.length <= 120 ? email : null,
  };
}
