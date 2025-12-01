export interface ContactPerson {
  name: string | null;
  position: string | null;
  phone?: string | null;
  email?: string | null;
  personalId?: string | null;
}

export interface GenderDistribution {
  male: number;
  female: number;
}

export interface Business {
  id: string | null;
  name: string | null;
  nameGeorgian: string | null;
  taxPayerId: string | null;
  legalForm: string | null;
  registrationNumber: string | null;
  registrationDate: string | null;
  registrationAuthority: string | null;
  status: string | null;
  workHours: string | null;
  trademarks: string[];
  brands: string[];

  category: string | null;
  subcategories: string[];
  serviceCategories: string[];
  nace2004: string[];
  nace2016: string[];
  branchesRaw: string | null;
  serviceCentersRaw: string | null;
  tenders: string | null;
  tendersHistory: string | null;

  phoneNumbers: string[];
  emails: string[];
  website: string | null;

  address: string | null;
  city: string | null;
  region: string | null;

  description: string | null;

  contactPersons: ContactPerson[];

  employeeCount: number | null;
  temporaryEmployees: number | null;
  branches: number | null;
  serviceCenters: number | null;
  companySize: string | null;

  authorizedCapital: number | null;
  isVATPayer: boolean | null;
  managementAvgSalary: number | null;
  employeeAvgSalary: number | null;
  middleAvgSalary: string | null;
  lowerAvgSalary: string | null;
  turnoverRange: string | null;

  corporateVehicles: number | null;
  computers: number | null;

  avgEmployeeAge: number | null;
  genderDistribution: GenderDistribution | null;
  parentCompanies: string | null;
  subsidiaryCompanies: string | null;
  founders: string[];

  certifications: string[];

  socialLinks: string[];
  socialResponsibility: string | null;
  mobileService: string | null;
  internetService: string | null;
  oilCompanies: string | null;
  banks: string | null;
  insurance: string | null;
  exportInfo: string | null;
  importInfo: string | null;
  localShipments: string | null;
  internationalShipments: string | null;
  localPartners: string | null;
  foreignPartners: string | null;
  localSuppliers: string | null;
  foreignSuppliers: string | null;
  localDistributors: string | null;
  localDealers: string | null;
  auditService: string | null;
  legalService: string | null;
  accountingService: string | null;
  consultingService: string | null;
  advertisingService: string | null;
  courierService: string | null;
  propertyValuationService: string | null;

  rating: number | null;
  reviewsCount: number | null;
  profileUrl: string;
  lastUpdated: string | null;

  rawPageContent: string | null;
  rawTabPanelContent: string | null;

  extraFields: Record<string, any>;
}


