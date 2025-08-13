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

// Check if a field combination matches
const checkFieldCombination = (csvRow, airtableRecord, fieldCombination, linkedTable) => {
    if (!fieldCombination.fields || fieldCombination.fields.length === 0) {
        return { matches: false, score: 0, details: {} };
    }

    let allMatch = true;
    let totalScore = 0;
    let fieldCount = 0;
    const details = {};

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
        
        details[field.csvField] = {
            csvValue,
            airtableValue,
            similarity,
            matchType: field.matchType,
            required: fieldCombination.operator === 'AND'
        };

        totalScore += similarity;
        fieldCount++;

        // For AND combinations, all fields must have high similarity
        if (fieldCombination.operator === 'AND' && similarity < 0.9) {
            allMatch = false;
        }
    }

    if (fieldCount === 0) {
        return { matches: false, score: 0, details: {} };
    }

    const averageScore = totalScore / fieldCount;
    
    // For AND combinations, all must match well
    // For OR combinations, average score is used
    const matches = fieldCombination.operator === 'AND' ? allMatch : averageScore > 0.6;

    return {
        matches,
        score: averageScore,
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

// Check fuzzy match groups
const checkFuzzyMatchGroups = (csvRow, airtableRecord, fuzzyMatchGroups, linkedTable) => {
    if (!fuzzyMatchGroups || fuzzyMatchGroups.length === 0) {
        return { matches: false, score: 0, details: {} };
    }

    let totalScore = 0;
    let totalWeight = 0;
    const allDetails = {};

    for (const group of fuzzyMatchGroups) {
        let groupScore = 0;
        let groupWeight = 0;

        // AND logic between field combinations within a group
        let allCombinationsMatch = true;

        for (const combination of group.fieldCombinations) {
            const result = checkFieldCombination(csvRow, airtableRecord, combination, linkedTable);
            
            Object.assign(allDetails, result.details);
            
            const weight = combination.weight || 0.5;
            groupScore += result.score * weight;
            groupWeight += weight;

            // For fuzzy matching, we're more lenient - just need decent scores
            if (result.score < 0.4) {
                allCombinationsMatch = false;
            }
        }

        if (groupWeight > 0) {
            const normalizedGroupScore = groupScore / groupWeight;
            const groupWeightFactor = group.weight || 1.0;
            
            totalScore += normalizedGroupScore * groupWeightFactor;
            totalWeight += groupWeightFactor;
        }
    }

    if (totalWeight === 0) {
        return { matches: false, score: 0, details: allDetails };
    }

    const finalScore = totalScore / totalWeight;
    const matches = finalScore > 0.6;

    return {
        matches,
        score: finalScore,
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
            } else if (bestMatch && bestScore > 0.6) {
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