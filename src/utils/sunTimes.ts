export const getSunTimes = (date: Date) => {
    const month = date.getMonth();
    const sunTable = [
        { rise: 9.5, set: 14.5 },  // Jan
        { rise: 8.0, set: 16.5 },  // Feb
        { rise: 6.5, set: 18.0 },  // Mar
        { rise: 5.0, set: 20.5 },  // Apr
        { rise: 3.5, set: 22.0 },  // Maj
        { rise: 2.5, set: 23.5 },  // Jun
        { rise: 3.5, set: 22.5 },  // Jul
        { rise: 5.0, set: 20.5 },  // Aug
        { rise: 6.5, set: 19.0 },  // Sep
        { rise: 8.0, set: 16.5 },  // Okt
        { rise: 8.5, set: 14.5 },  // Nov
        { rise: 9.5, set: 14.0 }   // Dec
    ];

    const times = sunTable[month];
    const lastLight = times.set + 0.75;
    return { ...times, lastLight };
};

export const formatDecimalTime = (decimalTime: number): string => {
    const hours = Math.floor(decimalTime);
    const minutes = Math.round((decimalTime - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};
