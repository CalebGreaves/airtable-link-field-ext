// String similarity calculation utilities

export const calculateStringSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;
    
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    if (s1 === s2) return 1;

    // Simple word-based similarity
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const matches = words1.filter(word => words2.includes(word));
    
    return matches.length / Math.max(words1.length, words2.length);
};

export const processMatches = (csvData, linkedTable, base) => {
    if (!linkedTable || !csvData || csvData.length === 0) {
        return { definite: [], fuzzy: [], missing: csvData || [] };
    }

    const linkedQuery = linkedTable.selectRecords();
    const linkedRecords = linkedQuery.records;

    // Find email field in linked table
    const emailField = linkedTable.fields.find(field => 
        field.type === 'email' || 
        field.name.toLowerCase().includes('email')
    );

    // Find name field (usually primary field)
    const nameField = linkedTable.primaryField;

    // Find organization field
    const orgField = linkedTable.fields.find(field =>
        field.name.toLowerCase().includes('organization') ||
        field.name.toLowerCase().includes('company') ||
        field.name.toLowerCase().includes('center')
    );

    const definiteMatches = [];
    const fuzzyMatches = [];
    const missingRecords = [];

    csvData.forEach(csvRow => {
        let bestMatch = null;
        let bestScore = 0;
        let isDefiniteMatch = false;

        linkedRecords.forEach(airtableRecord => {
            const airtableEmail = emailField ? airtableRecord.getCellValueAsString(emailField) : '';
            const airtableName = nameField ? airtableRecord.getCellValueAsString(nameField) : '';
            const airtableOrg = orgField ? airtableRecord.getCellValueAsString(orgField) : '';

            const csvEmail = csvRow.email || csvRow.Email || '';
            const csvName = csvRow.name || csvRow.Name || '';
            const csvOrg = csvRow.organization || csvRow.Organization || csvRow['Health Center'] || '';

            // Definite match: exact email match
            if (csvEmail && airtableEmail && csvEmail.toLowerCase().trim() === airtableEmail.toLowerCase().trim()) {
                definiteMatches.push({
                    csvRow,
                    airtableRecord: {
                        id: airtableRecord.id,
                        name: airtableName,
                        email: airtableEmail,
                        organization: airtableOrg
                    },
                    matchType: 'email',
                    similarity: 1.0
                });
                isDefiniteMatch = true;
                return;
            }

            // Fuzzy match: similar name and organization
            if (!isDefiniteMatch && csvName && airtableName) {
                const nameSimilarity = calculateStringSimilarity(csvName, airtableName);
                const orgSimilarity = csvOrg && airtableOrg ? 
                    calculateStringSimilarity(csvOrg, airtableOrg) : 0;

                const combinedScore = (nameSimilarity * 0.7) + (orgSimilarity * 0.3);

                if (combinedScore > 0.6 && combinedScore > bestScore) {
                    bestMatch = {
                        csvRow,
                        airtableRecord: {
                            id: airtableRecord.id,
                            name: airtableName,
                            email: airtableEmail,
                            organization: airtableOrg
                        },
                        similarity: combinedScore,
                        nameSimilarity,
                        orgSimilarity
                    };
                    bestScore = combinedScore;
                }
            }
        });

        if (isDefiniteMatch) {
            return;
        } else if (bestMatch && bestScore > 0.6) {
            fuzzyMatches.push(bestMatch);
        } else {
            missingRecords.push(csvRow);
        }
    });

    return {
        definite: definiteMatches,
        fuzzy: fuzzyMatches,
        missing: missingRecords
    };
};