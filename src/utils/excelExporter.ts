import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";
import { Business, ContactPerson } from "../types/Business";
import { logger } from "./logger";

const NEGATIVE_TEXT_VALUES = new Set([
  "არ ჰყავს",
  "არ სარგებლობს",
  "არ აქვს",
  "არ ახორციელებს",
  "არ აცხადებს ტენდერებს"
]);

function isUsefulTextField(
  businesses: Business[],
  selector: (b: Business) => string | null | undefined
): boolean {
  let anyValue = false;
  let allNegative = true;

  for (const biz of businesses) {
    const raw = selector(biz);
    if (!raw) continue;
    const norm = raw.replace(/\s+/g, " ").trim();
    if (!norm) continue;

    anyValue = true;
    if (!NEGATIVE_TEXT_VALUES.has(norm)) {
      allNegative = false;
      break;
    }
  }

  return anyValue && !allNegative;
}

function buildManagementStrings(biz: Business): {
  director: string | undefined;
  manager: string | undefined;
} {
  const contacts: ContactPerson[] = (biz.contactPersons ?? []) as any;

  const formatPerson = (p: ContactPerson): string => {
    const parts: string[] = [];
    if (p.name) parts.push(p.name);
    if (p.personalId) parts.push(`ID: ${p.personalId}`);
    if (p.phone) parts.push(`Tel: ${p.phone}`);
    if (p.email) parts.push(`Email: ${p.email}`);
    return parts.join(" | ");
  };

  const findByRole = (keyword: string): string | undefined => {
    const person = contacts.find((p) =>
      (p.position ?? "").toLowerCase().includes(keyword.toLowerCase())
    );
    return person ? formatPerson(person) : undefined;
  };

  return {
    director: findByRole("დირექტორი"),
    manager: findByRole("მენეჯერი")
  };
}

export async function exportBusinessesToExcel(
  businesses: Business[],
  outputPath: string
): Promise<void> {
  if (businesses.length === 0) {
    logger.warn("No businesses to export, skipping Excel generation.");
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Companies");

  const columns: any[] = [
    { header: "Company_ID", key: "id", width: 16 },
    { header: "Name", key: "name", width: 32 },
    { header: "Tax_ID", key: "taxPayerId", width: 20 },
    { header: "Legal_Form", key: "legalForm", width: 24 },
    { header: "Registration_Number", key: "registrationNumber", width: 16 },
    { header: "Registration_Date", key: "registrationDate", width: 14 },
    {
      header: "Registration_Authority",
      key: "registrationAuthority",
      width: 26
    },
    { header: "Status", key: "status", width: 16 },
    { header: "Work_Hours", key: "workHours", width: 24 },
    { header: "Category", key: "category", width: 26 },
    { header: "Subcategories", key: "subcategories", width: 30 },
    { header: "Service_Categories", key: "serviceCategories", width: 30 },
    { header: "NACE_2004", key: "nace2004", width: 28 },
    { header: "NACE_2016", key: "nace2016", width: 28 },
    { header: "Trademarks", key: "trademarks", width: 28 },
    { header: "Brands", key: "brands", width: 24 },
    { header: "Phones", key: "phones", width: 24 },
    { header: "Emails", key: "emails", width: 28 },
    { header: "Website", key: "website", width: 30 },
    { header: "Address", key: "address", width: 40 },
    { header: "City", key: "city", width: 16 },
    { header: "Region", key: "region", width: 22 },
    { header: "Employee_Count", key: "employeeCount", width: 16 },
    { header: "Temporary_Employees", key: "temporaryEmployees", width: 20 },
    { header: "Branches_Count", key: "branches", width: 16 },
    { header: "Service_Centers_Count", key: "serviceCenters", width: 22 },
    { header: "Company_Size", key: "companySize", width: 16 },
    { header: "VAT_Payer", key: "isVATPayer", width: 12 },
    { header: "Avg_Employee_Age", key: "avgEmployeeAge", width: 14 },
    { header: "Gender_Male_Pct", key: "genderMale", width: 14 },
    { header: "Gender_Female_Pct", key: "genderFemale", width: 14 },
    { header: "Parent_Companies", key: "parentCompanies", width: 32 },
    { header: "Subsidiary_Companies", key: "subsidiaryCompanies", width: 32 },
    { header: "Director", key: "director", width: 40 },
    { header: "Manager", key: "manager", width: 40 },
    { header: "Branches_Raw", key: "branchesRaw", width: 40 },
    { header: "Service_Centers_Raw", key: "serviceCentersRaw", width: 32 },
    { header: "Tenders", key: "tenders", width: 26 },
    { header: "Tenders_History", key: "tendersHistory", width: 26 },
    { header: "Authorized_Capital", key: "authorizedCapital", width: 18 },
    { header: "Computers_Count", key: "computers", width: 16 },
    { header: "Turnover_Range", key: "turnoverRange", width: 20 },
    { header: "Middle_Avg_Salary", key: "middleAvgSalary", width: 18 },
    { header: "Lower_Avg_Salary", key: "lowerAvgSalary", width: 18 },
    { header: "Corporate_Vehicles", key: "corporateVehicles", width: 18 },
    { header: "Description", key: "description", width: 60 },
    { header: "Social_Links", key: "socialLinks", width: 32 }
  ];

  if (isUsefulTextField(businesses, (b) => b.socialResponsibility)) {
    columns.push({
      header: "Social_Responsibility",
      key: "socialResponsibility",
      width: 28
    });
  }
  if (isUsefulTextField(businesses, (b) => b.mobileService)) {
    columns.push({ header: "Mobile_Service", key: "mobileService", width: 24 });
  }
  if (isUsefulTextField(businesses, (b) => b.internetService)) {
    columns.push({
      header: "Internet_Service",
      key: "internetService",
      width: 28
    });
  }
  if (isUsefulTextField(businesses, (b) => b.oilCompanies)) {
    columns.push({
      header: "Oil_Companies",
      key: "oilCompanies",
      width: 32
    });
  }
  if (isUsefulTextField(businesses, (b) => b.banks)) {
    columns.push({ header: "Banks", key: "banks", width: 40 });
  }
  if (isUsefulTextField(businesses, (b) => b.insurance)) {
    columns.push({ header: "Insurance", key: "insurance", width: 40 });
  }
  if (isUsefulTextField(businesses, (b) => b.exportInfo)) {
    columns.push({ header: "Export_Info", key: "exportInfo", width: 32 });
  }
  if (isUsefulTextField(businesses, (b) => b.importInfo)) {
    columns.push({ header: "Import_Info", key: "importInfo", width: 36 });
  }
  if (isUsefulTextField(businesses, (b) => b.localShipments)) {
    columns.push({
      header: "Local_Shipments",
      key: "localShipments",
      width: 32
    });
  }
  if (isUsefulTextField(businesses, (b) => b.internationalShipments)) {
    columns.push({
      header: "International_Shipments",
      key: "internationalShipments",
      width: 36
    });
  }
  if (isUsefulTextField(businesses, (b) => b.localPartners)) {
    columns.push({
      header: "Local_Partners",
      key: "localPartners",
      width: 32
    });
  }
  if (isUsefulTextField(businesses, (b) => b.foreignPartners)) {
    columns.push({
      header: "Foreign_Partners",
      key: "foreignPartners",
      width: 36
    });
  }
  if (isUsefulTextField(businesses, (b) => b.localSuppliers)) {
    columns.push({
      header: "Local_Suppliers",
      key: "localSuppliers",
      width: 32
    });
  }
  if (isUsefulTextField(businesses, (b) => b.foreignSuppliers)) {
    columns.push({
      header: "Foreign_Suppliers",
      key: "foreignSuppliers",
      width: 36
    });
  }
  if (isUsefulTextField(businesses, (b) => b.localDistributors)) {
    columns.push({
      header: "Local_Distributors",
      key: "localDistributors",
      width: 32
    });
  }
  if (isUsefulTextField(businesses, (b) => b.localDealers)) {
    columns.push({
      header: "Local_Dealers",
      key: "localDealers",
      width: 32
    });
  }
  if (isUsefulTextField(businesses, (b) => b.auditService)) {
    columns.push({ header: "Audit_Service", key: "auditService", width: 28 });
  }
  if (isUsefulTextField(businesses, (b) => b.legalService)) {
    columns.push({ header: "Legal_Service", key: "legalService", width: 28 });
  }
  if (isUsefulTextField(businesses, (b) => b.accountingService)) {
    columns.push({
      header: "Accounting_Service",
      key: "accountingService",
      width: 28
    });
  }
  if (isUsefulTextField(businesses, (b) => b.consultingService)) {
    columns.push({
      header: "Consulting_Service",
      key: "consultingService",
      width: 28
    });
  }
  if (isUsefulTextField(businesses, (b) => b.advertisingService)) {
    columns.push({
      header: "Advertising_Service",
      key: "advertisingService",
      width: 28
    });
  }
  if (isUsefulTextField(businesses, (b) => b.courierService)) {
    columns.push({
      header: "Courier_Service",
      key: "courierService",
      width: 28
    });
  }
  if (isUsefulTextField(businesses, (b) => b.propertyValuationService)) {
    columns.push({
      header: "Property_Valuation_Service",
      key: "propertyValuationService",
      width: 32
    });
  }

  columns.push({ header: "Profile_URL", key: "profileUrl", width: 40 });

   worksheet.columns = columns;

   const georgianHeaderByEnglish: Record<string, string> = {
     Company_ID: "კომპანიის ID",
     Name: "დასახელება",
     Tax_ID: "საიდენტიფიკაციო კოდი",
     Legal_Form: "სამართლებრივი ფორმა",
     Registration_Number: "რეგისტრაციის ნომერი",
     Registration_Date: "რეგისტრაციის თარიღი",
     Registration_Authority: "მარეგისტრ. ორგანო",
     Status: "სტატუსი",
     Work_Hours: "სამუშაო საათები",
     Category: "საქმიანობის კატეგორიები",
     Subcategories: "ქვე-კატეგორიები",
     Service_Categories: "საქმიანობის სფერო",
     NACE_2004: "ეროვნული კლასიფიკატორები (NACE 2004)",
     NACE_2016: "ეროვნული კლასიფიკატორები (NACE 2016)",
     Trademarks: "სავაჭრო მარკები",
     Brands: "ბრენდები",
     Phones: "ტელეფონი",
     Emails: "იმეილი",
     Website: "ვებ-საიტი",
     Address: "მისამართი",
     City: "ქალაქი",
     Region: "რაიონი",
     Employee_Count: "თანამშრომელთა რ-ბა",
     Temporary_Employees: "დროებითი თანამშრომლები",
     Branches_Count: "ფილიალების რ-ბა",
     Service_Centers_Count: "სერვის-ცენტრების რ-ბა",
     Company_Size: "კომპანიის ზომა",
     VAT_Payer: "დღგ-ს გადამხდელი",
     Avg_Employee_Age: "თანამშრომლების საშუალო ასაკი",
     Gender_Male_Pct: "გენდერული განაწილება (კაცი)",
     Gender_Female_Pct: "გენდერული განაწილება (ქალი)",
      Parent_Companies: "მშობელი კომპანიები",
      Subsidiary_Companies: "შვილობილი კომპანიები",
      Director: "დირექტორი",
      Manager: "მენეჯერი",
     Branches_Raw: "ფილიალები",
     Service_Centers_Raw: "სერვის-ცენტრები",
     Tenders: "ტენდერები",
     Tenders_History: "ტენდერების ისტორია",
     Authorized_Capital: "საწესდებო კაპიტალი",
     Computers_Count: "კომპიუტერების რ-ბა",
     Turnover_Range: "ბრუნვის დიაპაზონი",
     Middle_Avg_Salary: "შუა რგოლის თანამშ. საშ. ხელფასი",
     Lower_Avg_Salary: "ქვედა რგოლის თანამშ. საშ. ხელფასი",
     Corporate_Vehicles: "კორპორატიული ავტომობილები",
     Description: "აღწერილობა",
     Social_Links: "სოციალური ბმულები",
     Social_Responsibility: "სოციალური პასუხისმგებლობა",
     Mobile_Service: "მობილური კავშირის მომსახურება",
     Internet_Service: "ინტერნეტ კავშირის მომსახურება",
     Oil_Companies: "მომსახურე ნავთობკომპანიები",
     Banks: "ბანკები",
     Insurance: "დაზღვევა",
     Export_Info: "ექსპორტი",
     Import_Info: "იმპორტი",
     Local_Shipments: "ადგილობრივი გადაზიდვები",
     International_Shipments: "საერთაშორისო გადაზიდვები",
     Local_Partners: "ადგილობრივი პარტნიორები",
     Foreign_Partners: "უცხოელი პარტნიორები",
     Local_Suppliers: "ადგილობრივი მომწოდებლები",
     Foreign_Suppliers: "უცხოელი მომწოდებლები",
     Local_Distributors: "ადგილობრივი დისტრიბუტორები",
     Local_Dealers: "ადგილობრივი დილერები",
     Audit_Service: "აუდიტორული მომსახურება",
     Legal_Service: "იურიდიული მომსახურება",
     Accounting_Service: "საბუღალტრო მომსახურება",
     Consulting_Service: "საკონსულტაციო მომსახურება",
     Advertising_Service: "სარეკლამო კომპანიების მომსახურება",
     Courier_Service: "საკურიერო მომსახურება",
     Property_Valuation_Service: "ქონების საშემფასებლო მომსახურება",
     Profile_URL: "პროფილის ბმული"
   };

   const georgianHeaderRowValues = worksheet.columns.map((col) => {
     const header = col.header as string | undefined;
     if (!header) return "";
     return georgianHeaderByEnglish[header] ?? "";
   });

   worksheet.insertRow(2, georgianHeaderRowValues);

   for (const biz of businesses) {
     const { director, manager } = buildManagementStrings(biz);

    worksheet.addRow({
      id: biz.id,
      name: biz.name,
      taxPayerId: biz.taxPayerId,
      legalForm: biz.legalForm,
      registrationNumber: biz.registrationNumber,
      registrationDate: biz.registrationDate,
      registrationAuthority: biz.registrationAuthority,
      status: biz.status,
      workHours: biz.workHours,
      category: biz.category,
      subcategories: biz.subcategories.join(", "),
      serviceCategories: biz.serviceCategories.join(", "),
      nace2004: biz.nace2004.join(", "),
      nace2016: biz.nace2016.join(", "),
      trademarks: biz.trademarks.join(", "),
      brands: biz.brands.join(", "),
      phones: biz.phoneNumbers.join(", "),
      emails: biz.emails.join(", "),
      website: biz.website,
      address: biz.address,
      city: biz.city,
      region: biz.region,
      employeeCount: biz.employeeCount ?? undefined,
      temporaryEmployees: biz.temporaryEmployees ?? undefined,
      branches: biz.branches ?? undefined,
      serviceCenters: biz.serviceCenters ?? undefined,
      companySize: biz.companySize ?? undefined,
      isVATPayer:
        biz.isVATPayer === null ? undefined : biz.isVATPayer ? "Yes" : "No",
      avgEmployeeAge: biz.avgEmployeeAge ?? undefined,
      genderMale: biz.genderDistribution?.male ?? undefined,
      genderFemale: biz.genderDistribution?.female ?? undefined,
       parentCompanies: biz.parentCompanies ?? undefined,
       subsidiaryCompanies: biz.subsidiaryCompanies ?? undefined,
       director,
       manager,
      branchesRaw: biz.branchesRaw ?? undefined,
      serviceCentersRaw: biz.serviceCentersRaw ?? undefined,
      tenders: biz.tenders ?? undefined,
      tendersHistory: biz.tendersHistory ?? undefined,
      authorizedCapital: biz.authorizedCapital ?? undefined,
      computers: biz.computers ?? undefined,
      turnoverRange: biz.turnoverRange ?? undefined,
      middleAvgSalary: biz.middleAvgSalary ?? undefined,
      lowerAvgSalary: biz.lowerAvgSalary ?? undefined,
      corporateVehicles: biz.corporateVehicles ?? undefined,
      description: biz.description,
      socialLinks: biz.socialLinks.join(", "),
      socialResponsibility: biz.socialResponsibility ?? undefined,
      mobileService: biz.mobileService ?? undefined,
      internetService: biz.internetService ?? undefined,
      oilCompanies: biz.oilCompanies ?? undefined,
      banks: biz.banks ?? undefined,
      insurance: biz.insurance ?? undefined,
      exportInfo: biz.exportInfo ?? undefined,
      importInfo: biz.importInfo ?? undefined,
      localShipments: biz.localShipments ?? undefined,
      internationalShipments: biz.internationalShipments ?? undefined,
      localPartners: biz.localPartners ?? undefined,
      foreignPartners: biz.foreignPartners ?? undefined,
      localSuppliers: biz.localSuppliers ?? undefined,
      foreignSuppliers: biz.foreignSuppliers ?? undefined,
      localDistributors: biz.localDistributors ?? undefined,
      localDealers: biz.localDealers ?? undefined,
      auditService: biz.auditService ?? undefined,
      legalService: biz.legalService ?? undefined,
      accountingService: biz.accountingService ?? undefined,
      consultingService: biz.consultingService ?? undefined,
      advertisingService: biz.advertisingService ?? undefined,
      courierService: biz.courierService ?? undefined,
      propertyValuationService: biz.propertyValuationService ?? undefined,
      profileUrl: biz.profileUrl
    });
  }

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4F81BD" }
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  const geoHeaderRow = worksheet.getRow(2);
  geoHeaderRow.font = { bold: true };
  geoHeaderRow.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.views = [{ state: "frozen", ySplit: 2 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columnCount }
  };

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return;
    row.alignment = { wrapText: true, vertical: "top" };
  });

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  await workbook.xlsx.writeFile(outputPath);
  logger.info(`Excel file written to ${outputPath}`);
}


