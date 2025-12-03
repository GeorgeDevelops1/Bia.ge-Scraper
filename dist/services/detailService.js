"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeBusinessDetail = scrapeBusinessDetail;
const logger_1 = require("../utils/logger");
function extractIdFromUrl(url) {
    const match = url.match(/\/Company\/(\d+)/i);
    return match ? match[1] : null;
}
function uniqueNonEmpty(values) {
    return Array.from(new Set(values
        .filter((v) => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => v.length > 0)));
}
function parseInteger(value) {
    if (!value)
        return null;
    const cleaned = value.replace(/[^\d]/g, "");
    if (!cleaned)
        return null;
    const n = parseInt(cleaned, 10);
    return Number.isNaN(n) ? null : n;
}
function parseGenderDistribution(male, female) {
    if (!male && !female)
        return null;
    const toNumber = (v) => {
        if (!v)
            return 0;
        const cleaned = v.replace(/[^\d]/g, "");
        const n = parseInt(cleaned, 10);
        return Number.isNaN(n) ? 0 : n;
    };
    return {
        male: toNumber(male),
        female: toNumber(female)
    };
}
async function scrapeBusinessDetail(page, url) {
    logger_1.logger.info(`Scraping company detail: ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });
    const profileUrl = page.url();
    const [pageContentText, tabPanelText, structured] = await Promise.all([
        page
            .$eval("#PageContent", (el) => el.innerText.trim())
            .catch(() => null),
        page
            .$eval("#TabPanelBox", (el) => el.innerText.trim())
            .catch(() => null),
        page.evaluate(() => {
            const labelMap = {};
            const collectValue = (titleNode) => {
                let nextSibling = titleNode.nextElementSibling;
                while (nextSibling) {
                    if (nextSibling.classList.contains("data-list")) {
                        const list = nextSibling;
                        if (list.tagName === "UL") {
                            const items = Array.from(list.querySelectorAll("li")).map((li) => li.innerText.trim());
                            return items.join(" | ");
                        }
                        return list.innerText.trim();
                    }
                    if (nextSibling.classList.contains("data-title")) {
                        break;
                    }
                    nextSibling = nextSibling.nextElementSibling;
                }
                return "";
            };
            const titleNodes = Array.from(document.querySelectorAll("#TabPanelBox .data-title"));
            for (const node of titleNodes) {
                const label = node.innerText.trim();
                if (!label)
                    continue;
                const value = collectValue(node).replace(/\s+/g, " ").trim();
                if (!value)
                    continue;
                if (labelMap[label]) {
                    labelMap[label] = `${labelMap[label]} || ${value}`;
                }
                else {
                    labelMap[label] = value;
                }
            }
            const employees = [];
            const managementItems = document.querySelectorAll("#tpManagement .employees-box ul.data-list.with-bullets > li");
            managementItems.forEach((li) => {
                const titleEl = li.querySelector(".sub-data-title .title");
                const nameEls = li.querySelectorAll(".sub-data-title .text");
                const role = titleEl?.innerText.trim().replace(/:$/, "") ?? null;
                const name = nameEls[0]?.innerText.trim() ?? null;
                let personalId = null;
                nameEls.forEach((el) => {
                    const text = el.innerText.trim();
                    if (text.startsWith("პირადი ნომერი:")) {
                        personalId = text.split(":")[1]?.trim() ?? null;
                    }
                });
                const subList = li.querySelector(".sub-data-list");
                let email = null;
                let phone = null;
                if (subList) {
                    const subText = subList.innerText;
                    const emailMatch = subText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
                    if (emailMatch)
                        email = emailMatch[0];
                    const phoneMatch = subText.match(/\+995[0-9\s]+/);
                    if (phoneMatch)
                        phone = phoneMatch[0].trim();
                }
                employees.push({ role, name, personalId, email, phone });
            });
            const contacts = {
                address: null,
                phones: [],
                emails: [],
                website: null
            };
            const contactRows = document.querySelectorAll("#ContactsBox table.body tbody tr");
            contactRows.forEach((tr) => {
                const icon = tr.querySelector("td.data-icon img");
                const dataTitle = icon?.getAttribute("data-title") ?? "";
                const dataCell = tr.querySelector("td.data-list");
                if (!dataCell)
                    return;
                const text = dataCell.innerText.replace(/\s+/g, " ").trim();
                if (!text)
                    return;
                if (dataTitle === "მისამართი") {
                    contacts.address = text;
                }
                else if (dataTitle === "ტელეფონი") {
                    const phoneLinks = Array.from(dataCell.querySelectorAll("a[href^='tel:']"));
                    if (phoneLinks.length) {
                        contacts.phones.push(...phoneLinks.map((a) => a.innerText.replace(/\s+/g, " ").trim()));
                    }
                    else {
                        contacts.phones.push(text);
                    }
                }
                else if (dataTitle === "იმეილი") {
                    const emailLinks = Array.from(dataCell.querySelectorAll("a[href^='mailto:']"));
                    if (emailLinks.length) {
                        contacts.emails.push(...emailLinks.map((a) => a.innerText.trim()));
                    }
                    else {
                        contacts.emails.push(text);
                    }
                }
                else if (dataTitle === "ვებ-საიტი") {
                    const link = dataCell.querySelector("a[href]");
                    contacts.website =
                        link?.href ?? text.replace(/\s+/g, "").replace(/"$/g, "");
                }
            });
            contacts.phones = Array.from(new Set(contacts.phones));
            contacts.emails = Array.from(new Set(contacts.emails));
            return { labelMap, employees, contacts };
        })
    ]);
    const combinedText = [pageContentText, tabPanelText].filter(Boolean).join("\n\n") || "";
    let name = null;
    let nameGeorgian = null;
    if (pageContentText) {
        const lines = pageContentText
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        for (const l of lines) {
            if (l === "არ არის ლოგო" || /^\+\s*\d+$/.test(l))
                continue;
            if (!nameGeorgian && /[\u10A0-\u10FF]/.test(l)) {
                nameGeorgian = l;
            }
            if (!name && /[A-Za-z]/.test(l)) {
                name = l;
            }
        }
        if (!name) {
            const firstMeaningful = lines.find((l) => l !== "არ არის ლოგო" && !/^\+\s*\d+$/.test(l));
            name = firstMeaningful || null;
        }
    }
    const labels = structured.labelMap;
    const taxPayerId = labels["საიდენტიფიკაციო კოდი:"] ??
        (combinedText.match(/საიდენტიფიკაციო კოდი:\s*([0-9]+)/)?.[1] ?? null);
    const registrationNumberMatch = combinedText.match(/რეგისტრაციის ნომერი:\s*([0-9A-Za-z/-]+)/);
    const registrationNumberFromText = registrationNumberMatch
        ? registrationNumberMatch[1]
        : null;
    const legalAddress = labels["იურდიული მისამართი:"] ??
        labels["იურიდიული მისამართი:"] ?? null;
    let city = null;
    let region = null;
    const cityRegionSource = structured.contacts.address ?? legalAddress;
    if (cityRegionSource) {
        const parts = cityRegionSource.split(",").map((p) => p.trim());
        if (parts.length >= 3) {
            city = parts[1] || null;
            const regionPart = parts.find((p) => p.includes("რაიონი"));
            region = regionPart || null;
        }
    }
    const category = labels["საქმიანობის კატეგორიები:"] ?? null;
    const subcategories = category
        ? category.split("|").map((s) => s.trim())
        : [];
    const serviceCategoriesRaw = labels["საქმიანობის სფერო:"] ?? null;
    const serviceCategories = serviceCategoriesRaw
        ? serviceCategoriesRaw.split("|").map((s) => s.trim())
        : [];
    const trademarksRaw = labels["სავაჭრო მარკები:"] ?? null;
    const trademarks = trademarksRaw
        ? trademarksRaw.split("||").flatMap((chunk) => chunk.split("|").map((s) => s.trim()))
        : [];
    const brandsRaw = labels["ბრენდები:"] ?? null;
    const brands = brandsRaw
        ? brandsRaw.split("||").flatMap((chunk) => chunk.split("|").map((s) => s.trim()))
        : [];
    const nace2004Raw = labels["ეროვნული კლასიფიკატორები (NACE 2004):"] ?? null;
    const nace2016Raw = labels["ეროვნული კლასიფიკატორები (NACE 2016):"] ?? null;
    const nace2004 = nace2004Raw
        ? nace2004Raw.split("|").map((s) => s.trim())
        : [];
    const nace2016 = nace2016Raw
        ? nace2016Raw.split("|").map((s) => s.trim())
        : [];
    const phoneNumbers = uniqueNonEmpty([
        ...structured.contacts.phones,
        ...(combinedText.match(/\+995[0-9\s,]+/g) || []).flatMap((block) => block.split(",").map((p) => p.trim()))
    ]);
    const emailMatches = combinedText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
    const emails = uniqueNonEmpty([...structured.contacts.emails, ...emailMatches]);
    const website = structured.contacts.website ?? null;
    const isVATVal = labels["დღგ-ს გადამხდელი:"] ||
        (combinedText.includes("დღგ-ს გადამხდელი: არის")
            ? "არის"
            : combinedText.includes("დღგ-ს გადამხდელი: არ არის")
                ? "არ არის"
                : null);
    let isVATPayer = null;
    if (isVATVal) {
        if (isVATVal.includes("არის") && !isVATVal.includes("არ არის")) {
            isVATPayer = true;
        }
        else if (isVATVal.includes("არ არის")) {
            isVATPayer = false;
        }
    }
    const lastUpdatedMatch = combinedText.match(/ბოლო განახლების თარიღი:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/);
    const lastUpdated = lastUpdatedMatch ? lastUpdatedMatch[1] : null;
    const employees = structured.employees.map((e) => ({
        name: e.name,
        position: e.role,
        phone: e.phone,
        email: e.email,
        personalId: e.personalId
    }));
    let avgEmployeeAge = parseInteger(labels["თანამშრომლების საშუალო ასაკი:"]);
    const avgAgeMatch = combinedText.match(/თანამშრომლების საშუალო ასაკი:([0-9]+)/);
    if (avgAgeMatch) {
        const age = parseInt(avgAgeMatch[1], 10);
        if (!Number.isNaN(age)) {
            avgEmployeeAge = age;
        }
    }
    let genderDistribution = null;
    const genderPercentMatch = combinedText.match(/გენდერული განაწილება \(კაცი\):([0-9]+)%\s*გენდერული განაწილება \(ქალი\):([0-9]+)%/);
    if (genderPercentMatch) {
        const male = parseInt(genderPercentMatch[1], 10);
        const female = parseInt(genderPercentMatch[2], 10);
        if (!Number.isNaN(male) && !Number.isNaN(female)) {
            genderDistribution = { male, female };
        }
    }
    else {
        const maleMatch = combinedText.match(/გენდერული განაწილება \(კაცი\):([0-9]+)%/);
        const femaleMatch = combinedText.match(/გენდერული განაწილება \(ქალი\):([0-9]+)%/);
        if (maleMatch || femaleMatch) {
            const male = maleMatch ? parseInt(maleMatch[1], 10) : 0;
            const female = femaleMatch ? parseInt(femaleMatch[1], 10) : 0;
            if (!Number.isNaN(male) && !Number.isNaN(female) && (male > 0 || female > 0)) {
                genderDistribution = { male, female };
            }
        }
    }
    if (!genderDistribution) {
        genderDistribution = parseGenderDistribution(labels["გენდერული განაწილება (კაცი):"], labels["გენდერული განაწილება (ქალი):"]);
    }
    const employeeCount = parseInteger(labels["თანამშრომელთა რ-ბა:"]);
    const temporaryEmployees = parseInteger(labels["დროებითი თანამშრომლები:"]);
    const branchesCount = parseInteger(labels["ფილიალების რ-ბა:"]);
    const serviceCentersCount = parseInteger(labels["სერვის-ცენტრების რ-ბა:"]);
    const computers = parseInteger(labels["კომპიუტერების რ-ბა:"]);
    const managementAvgSalaryRaw = labels["მენეჯმენტის საშუალო ხელფასი:"];
    const middleAvgSalary = labels["შუა რგოლის თანამშ. საშ. ხელფასი:"] ?? null;
    const lowerAvgSalary = labels["ქვედა რგოლის თანამშ. საშ. ხელფასი:"] ?? null;
    const authorizedCapital = parseInteger(labels["საწესდებო კაპიტალი:"]);
    const turnoverRange = labels["ბრუნვის დიაპაზონი:"] ?? null;
    const certificationsRaw = labels["სერტიფიკატები:"] ?? null;
    const certifications = certificationsRaw
        ? uniqueNonEmpty(certificationsRaw.split("|"))
        : [];
    const socialLinks = [];
    const business = {
        id: extractIdFromUrl(profileUrl),
        name: nameGeorgian ?? name,
        nameGeorgian,
        taxPayerId,
        legalForm: labels["სამართლებრივი ფორმა:"] ?? null,
        registrationNumber: labels["რეგისტრაციის ნომერი:"] ??
            registrationNumberFromText ??
            taxPayerId,
        registrationDate: labels["რეგისტრაციის თარიღი:"] ?? null,
        registrationAuthority: labels["მარეგისტრ. ორგანო:"] ?? null,
        status: labels["სტატუსი:"] ?? null,
        workHours: labels["სამუშაო საათები:"] ?? null,
        trademarks,
        brands,
        category,
        subcategories,
        serviceCategories,
        nace2004,
        nace2016,
        branchesRaw: labels["ფილიალები:"] ?? null,
        serviceCentersRaw: labels["სერვის-ცენტრები:"] ?? null,
        tenders: labels["ტენდერები:"] ?? null,
        tendersHistory: labels["ტენდერების ისტორია:"] ?? null,
        phoneNumbers,
        emails,
        website,
        address: structured.contacts.address ?? legalAddress,
        city,
        region,
        description: null,
        contactPersons: employees,
        employeeCount,
        temporaryEmployees,
        branches: branchesCount,
        serviceCenters: serviceCentersCount,
        companySize: labels["კომპანიის ზომა:"] ?? null,
        authorizedCapital,
        turnoverRange,
        isVATPayer,
        managementAvgSalary: null,
        employeeAvgSalary: null,
        middleAvgSalary,
        lowerAvgSalary,
        corporateVehicles: labels["კორპორატიული ავტომობილები:"]?.includes("არ აქვს") ?? false
            ? 0
            : null,
        computers,
        avgEmployeeAge,
        genderDistribution,
        parentCompanies: labels["მშობელი კომპანიები:"] ?? null,
        subsidiaryCompanies: labels["შვილობილი კომპანიები:"] ?? null,
        founders: labels["დამფუძნებლები:"]
            ? labels["დამფუძნებლები:"].split("||").map((s) => s.trim())
            : [],
        certifications,
        socialLinks,
        socialResponsibility: labels["სოციალური პასუხისმგებლობა:"] ?? null,
        mobileService: labels["მობილური კავშირის მომსახურება:"] ?? null,
        internetService: labels["ინტერნეტ კავშირის მომსახურება:"] ?? null,
        oilCompanies: labels["მომსახურე ნავთობკომპანიები:"] ?? null,
        banks: labels["ბანკები:"] ?? null,
        insurance: labels["დაზღვევა:"] ?? null,
        exportInfo: labels["ექსპორტი:"] ?? null,
        importInfo: labels["იმპორტი:"] ?? null,
        localShipments: labels["ადგილობრივი გადაზიდვები:"] ?? null,
        internationalShipments: labels["საერთაშორისო გადაზიდვები:"] ?? null,
        localPartners: labels["ადგილობრივი პარტნიორები:"] ?? null,
        foreignPartners: labels["უცხოელი პარტნიორები:"] ?? null,
        localSuppliers: labels["ადგილობრივი მომწოდებლები:"] ?? null,
        foreignSuppliers: labels["უცხოელი მომწოდებლები:"] ?? null,
        localDistributors: labels["ადგილობრივი დისტრიბუტორები:"] ?? null,
        localDealers: labels["ადგილობრივი დილერები:"] ?? null,
        auditService: labels["აუდიტორული მომსახურება:"] ?? null,
        legalService: labels["იურიდიული მომსახურება:"] ?? null,
        accountingService: labels["საბუღალტრო მომსახურება:"] ?? null,
        consultingService: labels["საკონსულტაციო მომსახურება:"] ?? null,
        advertisingService: labels["სარეკლამო კომპანიების მომსახურება:"] ?? null,
        courierService: labels["საკურიერო მომსახურება:"] ?? null,
        propertyValuationService: labels["ქონების საშেমფასებლო მომსახურება:"] ??
            labels["ქონების საშემფასებლო მომსახურება:"] ??
            null,
        rating: null,
        reviewsCount: null,
        profileUrl,
        lastUpdated,
        rawPageContent: pageContentText,
        rawTabPanelContent: tabPanelText,
        extraFields: {
            labelMap: labels
        }
    };
    return business;
}
