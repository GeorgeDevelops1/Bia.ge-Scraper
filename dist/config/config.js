"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    baseUrl: "https://www.bia.ge",
    loginUrl: "https://www.bia.ge/Account/Login?ReturnUrl=%2FEN%2Fmybia",
    searchUrl: "https://www.bia.ge/Company/Search",
    email: "lpetriashvili@euroins.ge",
    password: "petriashvili123",
    maxCompanies: 15,
    pageDelayMs: 1500,
    detailDelayMs: 1000,
    checkpointEvery: 100,
    outputExcelPath: "output/bia_companies.xlsx"
};
