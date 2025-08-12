// Enhanced string similarity calculation utilities

// Levenshtein distance for typo detection
const levenshteinDistance = (str1, str2) => {
    const matrix = [];
    const len1 = str1.length;
    const len2 = str2.length;

    for (let i = 0; i <= len2; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= len1; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len2; i++) {
        for (let j = 1; j <= len1; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[len2][len1];
};

// Calculate similarity ratio (0-1) based on Levenshtein distance
const levenshteinSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
};

// Word-based similarity for multi-word fields
const wordBasedSimilarity = (str1, str2) => {
    if (!str1 || !str2) return 0;
    
    const words1 = str1.toLowerCase().trim().split(/\s+/);
    const words2 = str2.toLowerCase().trim().split(/\s+/);
    
    const matches = words1.filter(word => words2.includes(word));
    return matches.length / Math.max(words1.length, words2.length);
};

// Main similarity calculation with different matching types
export const calculateFieldSimilarity = (csvValue, airtableValue, matchType = 'fuzzy') => {
    if (!csvValue || !airtableValue) return 0;
    
    const csvStr = String(csvValue).trim();
    const airtableStr = String(airtableValue).trim();
    
    if (csvStr === '' || airtableStr === '') return 0;
    
    switch (matchType) {
        case 'exact':
            return csvStr.toLowerCase() === airtableStr.toLowerCase() ? 1 : 0;
            
        case 'fuzzy':
            // Use Levenshtein similarity for basic fuzzy matching
            return levenshteinSimilarity(csvStr, airtableStr);
            
        case 'word':
            // Word-based matching for multi-word fields
            return wordBasedSimilarity(csvStr, airtableStr);
            
        case 'contains':
            // Check if one string contains the other
            const lower1 = csvStr.toLowerCase();
            const lower2 = airtableStr.toLowerCase();
            if (lower1.includes(lower2) || lower2.includes(lower1)) {
                return 0.8; // High similarity if one contains the other
            }
            return 0;
            
        default:
            return levenshteinSimilarity(csvStr, airtableStr);
    }
};

export const processMatches = (csvData, linkedTable, base, fieldMappings) => {
    if (!linkedTable || !csvData || csvData.length === 0 || !fieldMappings) {
        return { definite: [], fuzzy: [], missing: csvData || [] };
    }

    const linkedQuery = linkedTable.selectRecords();
    const linkedRecords = linkedQuery.records;

    const definiteMatches = [];
    const fuzzyMatches = [];
    const missingRecords = [];

    // Get the exact match field from Airtable
    const exactMatchAirtableField = linkedTable.getFieldByIdIfExists(fieldMappings.exactMatchField.airtableField);
    
    csvData.forEach(csvRow => {
        let bestMatch = null;
        let bestScore = 0;
        let isDefiniteMatch = false;

        linkedRecords.forEach(airtableRecord => {
            // Check for exact match first
            if (exactMatchAirtableField && fieldMappings.exactMatchField.csvField) {
                const csvValue = csvRow[fieldMappings.exactMatchField.csvField];
                const airtableValue = airtableRecord.getCellValueAsString(exactMatchAirtableField);
                
                const exactSimilarity = calculateFieldSimilarity(csvValue, airtableValue, 'exact');
                
                if (exactSimilarity === 1) {
                    definiteMatches.push({
                        csvRow,
                        airtableRecord: {
                            id: airtableRecord.id,
                            name: airtableRecord.getCellValueAsString(linkedTable.primaryField),
                            record: airtableRecord
                        },
                        matchType: 'exact',
                        similarity: 1.0
                    });
                    isDefiniteMatch = true;
                    return;
                }
            }

            // If no exact match, check fuzzy matches
            if (!isDefiniteMatch) {
                let combinedScore = 0;
                let totalWeight = 0;
                const fieldMatches = {};

                fieldMappings.fuzzyMatchFields.forEach(fuzzyField => {
                    if (fuzzyField.csvField && fuzzyField.airtableField) {
                        const airtableField = linkedTable.getFieldByIdIfExists(fuzzyField.airtableField);
                        if (airtableField) {
                            const csvValue = csvRow[fuzzyField.csvField];
                            const airtableValue = airtableRecord.getCellValueAsString(airtableField);
                            
                            const similarity = calculateFieldSimilarity(
                                csvValue, 
                                airtableValue, 
                                fuzzyField.matchType || 'fuzzy'
                            );
                            
                            fieldMatches[fuzzyField.csvField] = {
                                csvValue,
                                airtableValue,
                                similarity,
                                weight: fuzzyField.weight,
                                matchType: fuzzyField.matchType || 'fuzzy'
                            };
                            
                            combinedScore += similarity * fuzzyField.weight;
                            totalWeight += fuzzyField.weight;
                        }
                    }
                });

                if (totalWeight > 0) {
                    const normalizedScore = combinedScore / totalWeight;
                    
                    if (normalizedScore > 0.6 && normalizedScore > bestScore) {
                        bestMatch = {
                            csvRow,
                            airtableRecord: {
                                id: airtableRecord.id,
                                name: airtableRecord.getCellValueAsString(linkedTable.primaryField),
                                record: airtableRecord
                            },
                            similarity: normalizedScore,
                            fieldMatches
                        };
                        bestScore = normalizedScore;
                    }
                }
            }
        });

        if (isDefiniteMatch) {
            return; // Already added to definiteMatches
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