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
            // Check if one string contains the other - FIXED
            const lower1 = csvStr.toLowerCase();
            const lower2 = airtableStr.toLowerCase();
            
            // If they're exactly the same, return 1.0
            if (lower1 === lower2) {
                return 1.0;
            }
            
            // If one contains the other, return high similarity
            if (lower1.includes(lower2) || lower2.includes(lower1)) {
                return 0.9; // High similarity but not perfect since they're not identical
            }
            return 0;
            
        default:
            return levenshteinSimilarity(csvStr, airtableStr);
    }
};

// Check if a field combination matches with pure pass/fail logic
const checkFieldCombination = (csvRow, airtableRecord, fieldCombination, linkedTable) => {
    if (!fieldCombination.fields || fieldCombination.fields.length === 0) {
        return { matches: false, score: 0, details: {} };
    }

    const details = {};
    const fieldResults = [];

    // Evaluate each field as pass/fail
    for (const field of fieldCombination.fields) {
        if (!field.csvField || !field.airtableField) {
            continue; // Skip incomplete field mappings
        }

        const airtableField = linkedTable.getFieldByIdIfExists(field.airtableField);
        if (!airtableField) {
            continue;
        }

        const csvValue = csvRow[field.csvField];
        const airtableValue = airtableRecord.getCellValueAsString(airtableField);
        
        const similarity = calculateFieldSimilarity(csvValue, airtableValue, field.matchType);
        
        // Determine pass/fail based on field type
        let passes = false;
        if (field.matchType === 'exact') {
            passes = similarity >= 1.0; // Exact must be perfect
        } else {
            passes = similarity >= 0.8; // Fuzzy must be 80%+
        }

        details[field.csvField] = {
            csvValue,
            airtableValue,
            similarity,
            matchType: field.matchType,
            passes: passes,
            required: fieldCombination.operator === 'AND'
        };

        fieldResults.push(passes);
    }

    if (fieldResults.length === 0) {
        return { matches: false, score: 0, details };
    }

    // Apply AND/OR logic to field results
    let matches = false;
    if (fieldCombination.operator === 'AND') {
        matches = fieldResults.every(result => result === true); // ALL must pass
    } else {
        matches = fieldResults.some(result => result === true); // ANY must pass
    }

    // For display purposes, calculate an average similarity score
    // (This is just for the UI, doesn't affect matching logic)
    const totalSimilarity = Object.values(details).reduce((sum, detail) => sum + detail.similarity, 0);
    const avgScore = totalSimilarity / Object.keys(details).length;

    return {
        matches,
        score: avgScore, // Only used for display
        details
    };
};

// Check if any exact match group matches
const checkExactMatchGroups = (csvRow, airtableRecord, exactMatchGroups, linkedTable) => {
    for (const group of exactMatchGroups) {
        // OR logic between field combinations within a group
        for (const combination of group.fieldCombinations) {
            const result = checkFieldCombination(csvRow, airtableRecord, combination, linkedTable);
            if (result.matches) {
                return {
                    matches: true,
                    score: result.score,
                    details: result.details,
                    matchedCombination: combination
                };
            }
        }
    }
    
    return { matches: false, score: 0, details: {} };
};

// Check fuzzy match groups with pure pass/fail logic
const checkFuzzyMatchGroups = (csvRow, airtableRecord, fuzzyMatchGroups, linkedTable) => {
    if (!fuzzyMatchGroups || fuzzyMatchGroups.length === 0) {
        return { matches: false, score: 0, details: {} };
    }

    const allDetails = {};
    const groupResults = [];

    for (const group of fuzzyMatchGroups) {
        const combinationResults = [];

        // Evaluate each field combination in the group
        for (const combination of group.fieldCombinations) {
            const result = checkFieldCombination(csvRow, airtableRecord, combination, linkedTable);
            Object.assign(allDetails, result.details);
            combinationResults.push(result.matches);
        }

        // Apply group-level OR logic (any combination can make the group pass)
        const groupPasses = combinationResults.some(result => result === true);
        groupResults.push(groupPasses);
    }

    // Apply top-level AND logic between groups (all groups must pass)
    const matches = groupResults.every(result => result === true);

    // Calculate average score for display (doesn't affect matching)
    const allScores = Object.values(allDetails).map(detail => detail.similarity);
    const avgScore = allScores.length > 0 ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length : 0;

    return {
        matches,
        score: avgScore,
        details: allDetails
    };
};

export const processMatches = (csvData, linkedTable, base, fieldMappings) => {
    console.log('Processing matches with:', { 
        csvRowCount: csvData?.length, 
        linkedTable: linkedTable?.name,
        fieldMappings 
    });

    if (!linkedTable || !csvData || csvData.length === 0 || !fieldMappings) {
        console.warn('Missing required data for processing matches');
        return { definite: [], fuzzy: [], missing: csvData || [] };
    }

    try {
        const linkedQuery = linkedTable.selectRecords();
        const linkedRecords = linkedQuery.records;
        
        console.log('Available linked records:', linkedRecords.length);

        const definiteMatches = [];
        const fuzzyMatches = [];
        const missingRecords = [];

        csvData.forEach((csvRow, rowIndex) => {
            let bestMatch = null;
            let bestScore = 0;
            let isDefiniteMatch = false;

            linkedRecords.forEach(airtableRecord => {
                try {
                    // Check for exact matches first
                    if (fieldMappings.exactMatchGroups && fieldMappings.exactMatchGroups.length > 0) {
                        const exactResult = checkExactMatchGroups(
                            csvRow, 
                            airtableRecord, 
                            fieldMappings.exactMatchGroups, 
                            linkedTable
                        );
                        
                        if (exactResult.matches) {
                            definiteMatches.push({
                                csvRow,
                                airtableRecord: {
                                    id: airtableRecord.id,
                                    name: airtableRecord.getCellValueAsString(linkedTable.primaryField),
                                    record: airtableRecord
                                },
                                matchType: 'exact',
                                similarity: exactResult.score,
                                fieldMatches: exactResult.details
                            });
                            isDefiniteMatch = true;
                            return;
                        }
                    }

                    // If no exact match and fuzzy matching is enabled, check fuzzy matches
                    if (!isDefiniteMatch && fieldMappings.enableFuzzyMatching && 
                        fieldMappings.fuzzyMatchGroups && fieldMappings.fuzzyMatchGroups.length > 0) {
                        
                        const fuzzyResult = checkFuzzyMatchGroups(
                            csvRow,
                            airtableRecord,
                            fieldMappings.fuzzyMatchGroups,
                            linkedTable
                        );

                        if (fuzzyResult.matches && fuzzyResult.score > bestScore) {
                            bestMatch = {
                                csvRow,
                                airtableRecord: {
                                    id: airtableRecord.id,
                                    name: airtableRecord.getCellValueAsString(linkedTable.primaryField),
                                    record: airtableRecord
                                },
                                similarity: fuzzyResult.score,
                                fieldMatches: fuzzyResult.details
                            };
                            bestScore = fuzzyResult.score;
                        }
                    }
                } catch (error) {
                    console.error(`Error processing record ${rowIndex} against Airtable record ${airtableRecord.id}:`, error);
                }
            });

            if (isDefiniteMatch) {
                return; // Already added to definiteMatches
            } else if (bestMatch) { // Remove score threshold check
                fuzzyMatches.push(bestMatch);
            } else {
                missingRecords.push(csvRow);
            }
        });

        const results = {
            definite: definiteMatches,
            fuzzy: fuzzyMatches,
            missing: missingRecords
        };

        console.log('Processing complete:', {
            definite: results.definite.length,
            fuzzy: results.fuzzy.length,
            missing: results.missing.length
        });

        return results;

    } catch (error) {
        console.error('Error in processMatches:', error);
        return { definite: [], fuzzy: [], missing: csvData };
    }
};