const fs = require("fs");

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function convertToSeconds(timeStr) {
    timeStr = timeStr.trim().toLowerCase();

    let [time, period] = timeStr.split(" ");
    let [h, m, s] = time.split(":").map(Number);

    if (period === "pm" && h !== 12) h += 12;
    if (period === "am" && h === 12) h = 0;

    return h * 3600 + m * 60 + s;
}

function secondsToHMS(sec) {
    let h = Math.floor(sec / 3600);
    sec %= 3600;

    let m = Math.floor(sec / 60);
    let s = sec % 60;

    return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function getShiftDuration(startTime, endTime) {
    let start = convertToSeconds(startTime);
    let end = convertToSeconds(endTime);

    let diff = end - start;

    return secondsToHMS(diff);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {

    let start = convertToSeconds(startTime);
    let end = convertToSeconds(endTime);

    let deliveryStart = convertToSeconds("8:00:00 am");
    let deliveryEnd = convertToSeconds("10:00:00 pm");

    let idle = 0;

    if (start < deliveryStart) {
        idle += deliveryStart - start;
    }

    if (end > deliveryEnd) {
        idle += end - deliveryEnd;
    }

    return secondsToHMS(idle);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {

    function toSeconds(timeStr) {
        let [h, m, s] = timeStr.split(":").map(Number);
        return h * 3600 + m * 60 + s;
    }

    let shift = toSeconds(shiftDuration);
    let idle = toSeconds(idleTime);

    let active = shift - idle;

    return secondsToHMS(active);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {

    function toSeconds(timeStr) {
        let [h, m, s] = timeStr.split(":").map(Number);
        return h * 3600 + m * 60 + s;
    }

    let active = toSeconds(activeTime);

    let normalQuota = toSeconds("8:24:00");
    let eidQuota = toSeconds("6:00:00");

    let d = new Date(date);

    let eidStart = new Date("2025-04-10");
    let eidEnd = new Date("2025-04-30");

    let quota = normalQuota;

    if (d >= eidStart && d <= eidEnd) {
        quota = eidQuota;
    }

    return active >= quota;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {

    let data = fs.readFileSync(textFile, "utf8").trim();
    let lines = data.split("\n");

    // check duplicate
    for (let i = 1; i < lines.length; i++) {
        let parts = lines[i].split(",");
        let driverID = parts[0];
        let date = parts[2];

        if (driverID === shiftObj.driverID && date === shiftObj.date) {
            return {};
        }
    }

    // calculate values
    let shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
    let idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
    let activeTime = getActiveTime(shiftDuration, idleTime);
    let met = metQuota(shiftObj.date, activeTime);
    let hasBonus = false;

    let newLine = [
        shiftObj.driverID,
        shiftObj.driverName,
        shiftObj.date,
        shiftObj.startTime,
        shiftObj.endTime,
        shiftDuration,
        idleTime,
        activeTime,
        met,
        hasBonus
    ].join(",");

    lines.push(newLine);

    fs.writeFileSync(textFile, lines.join("\n"));

    return {
        driverID: shiftObj.driverID,
        driverName: shiftObj.driverName,
        date: shiftObj.date,
        startTime: shiftObj.startTime,
        endTime: shiftObj.endTime,
        shiftDuration: shiftDuration,
        idleTime: idleTime,
        activeTime: activeTime,
        metQuota: met,
        hasBonus: hasBonus
    };
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {

    let data = fs.readFileSync(textFile, "utf8").trim();
    let lines = data.split("\n");

    for (let i = 1; i < lines.length; i++) {
        let parts = lines[i].split(",");

        if (parts[0] === driverID && parts[2] === date) {
            parts[9] = newValue;
            lines[i] = parts.join(",");
        }
    }

    fs.writeFileSync(textFile, lines.join("\n"));
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {

    let data = fs.readFileSync(textFile, "utf8").trim();
    let lines = data.split("\n");

    let count = 0;
    let found = false;

    for (let i = 1; i < lines.length; i++) {

        let parts = lines[i].split(",");

        let id = parts[0];
        let date = parts[2];
        let hasBonus = parts[9];

        if (id === driverID) {
            found = true;

            let m = date.split("-")[1];

            if (Number(m) === Number(month) && hasBonus === "true") {
                count++;
            }
        }
    }

    if (!found) return -1;

    return count;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {

    let data = fs.readFileSync(textFile, "utf8").trim();
    let lines = data.split("\n");

    let totalSeconds = 0;

    for (let i = 1; i < lines.length; i++) {

        let parts = lines[i].split(",");

        let id = parts[0];
        let date = parts[2];
        let activeTime = parts[7];

        if (id === driverID) {

            let m = date.split("-")[1];

            if (Number(m) === Number(month)) {

                let [h, min, s] = activeTime.split(":").map(Number);

                totalSeconds += h * 3600 + min * 60 + s;
            }
        }
    }

    return secondsToHMS(totalSeconds);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {

    let data = fs.readFileSync(textFile, "utf8").trim();
    let lines = data.split("\n");

    let totalSeconds = 0;

    for (let i = 1; i < lines.length; i++) {

        let parts = lines[i].split(",");
        let id = parts[0];
        let date = parts[2];
        let met = parts[8];

        if (id === driverID) {

            let m = Number(date.split("-")[1]);

            if (m === Number(month) && met === "true") {

                let d = new Date(date);
                let eidStart = new Date("2025-04-10");
                let eidEnd = new Date("2025-04-30");

                let dailyQuota;

                if (d >= eidStart && d <= eidEnd) {
                    dailyQuota = 6 * 3600;
                } else {
                    dailyQuota = (8 * 3600) + (24 * 60);
                }

                totalSeconds += dailyQuota;
            }
        }
    }

    totalSeconds -= bonusCount * 2 * 3600;

    return secondsToHMS(totalSeconds);
}

// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {

    function toSeconds(t){
        let [h,m,s] = t.split(":").map(Number);
        return h*3600 + m*60 + s;
    }

    const lines = fs.readFileSync(rateFile,"utf8").trim().split("\n");

    let basePay = null;
    let tier = null;

    for(let i = 0; i < lines.length; i++){
        const parts = lines[i].split(",");

        if(parts[0].trim() === driverID){
            basePay = Number(parts[2].trim());
            tier = Number(parts[3].trim());
            break;
        }
    }

    if(basePay === null) return null;

    const actual = toSeconds(actualHours);
    const required = toSeconds(requiredHours);

    if(actual >= required) return basePay;

    const missingSeconds = required - actual;

const allowanceMap = {1:50, 2:20, 3:10, 4:3};

const allowance = allowanceMap[tier] || 0;

const missingHours = Math.floor(missingSeconds / 3600);

const billableHours = Math.max(0, missingHours - allowance);

if (billableHours === 0) {
    return basePay;
}

const deductionRate = Math.floor(basePay / 185);

const deduction = billableHours * deductionRate;

return basePay - deduction;
}
module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
