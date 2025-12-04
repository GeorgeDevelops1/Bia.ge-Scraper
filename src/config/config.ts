export interface ScraperConfig {
  baseUrl: string;
  loginUrl: string;
  searchUrl: string;
  email: string;
  password: string;
  maxCompanies: number;
  /** საიდან დავიწყო ლისტინგის გვერდების გათვლა (მაგ: 39 გვერდიდან რომ გავაგრძელო) */
  startPage?: number;
  pageDelayMs: number;
  detailDelayMs: number;
  checkpointEvery: number;
  outputExcelPath: string;
  /** თუ true არის და excel უკვე არსებობს, ძველში აეფენდა ახალ რიგებს, თავიდან არ შექმნის */
  resumeFromExistingExcel?: boolean;
}

export const config: ScraperConfig = {
  baseUrl: "https://www.bia.ge",
  loginUrl: "https://www.bia.ge/Account/Login?ReturnUrl=%2FEN%2Fmybia",
  searchUrl: "https://www.bia.ge/Company/Search",
  email: "lpetriashvili@euroins.ge",
  password: "petriashvili123",
  maxCompanies: 20,
  // აქ შემყავს რომელი გვერდიდან გავაგრძელო (მაგალითად 39 გვერდიდან)
  startPage: 39,
  pageDelayMs: 1500,
  detailDelayMs: 1000,
  checkpointEvery: 100,
  outputExcelPath: "output/bia_companies.xlsx",
  // თუ ვაგრძელებ უკვე არსებულ excel-ზე, ვრთავ true-ს და ძველს არ შეეხოს, მასზე წერდეს
  resumeFromExistingExcel: true
};


