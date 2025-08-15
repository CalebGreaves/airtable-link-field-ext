import { calculateFieldSimilarity } from './matching';

// Enhanced processing function that uses field mappings
export const processMatchesWithMapping = (csvData, linkedTable, base, fieldMappings) => {
    console.log('Processing matches with mapping:', { 
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
        console.log('Field mappings:', fieldMappings.csvToAirtable);

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
                        const exactResult = checkExactMatchGroupsWithMapping(
                            csvRow, 
                            airtableRecord, 
                            fieldMappings.exactMatchGroups, 
                            fieldMappings.csvToAirtable,
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
                        
                        const fuzzyResult = checkFuzzyMatchGroupsWithMapping(
                            csvRow,
                            airtableRecord,
                            fieldMappings.fuzzyMatchGroups,
                            fieldMappings.csvToAirtable,
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
            } else if (bestMatch) {
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
        console.error('Error in processMatchesWithMapping:', error);
        return { definite: [], fuzzy: [], missing: csvData };
    }
};

// Helper functions for the new mapping structure
const checkExactMatchGroupsWithMapping = (csvRow, airtableRecord, exactMatchGroups, csvToAirtableMapping, linkedTable) => {
    for (const group of exactMatchGroups) {
        for (const combination of group.fieldCombinations) {
            const result = checkFieldCombinationWithMapping(csvRow, airtableRecord, combination, csvToAirtableMapping, linkedTable);
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

const checkFuzzyMatchGroupsWithMapping = (csvRow, airtableRecord, fuzzyMatchGroups, csvToAirtableMapping, linkedTable) => {
    if (!fuzzyMatchGroups || fuzzyMatchGroups.length === 0) {
        return { matches: false, score: 0, details: {} };
    }

    const allDetails = {};
    const groupResults = [];

    for (const group of fuzzyMatchGroups) {
        const combinationResults = [];

        for (const combination of group.fieldCombinations) {
            const result = checkFieldCombinationWithMapping(csvRow, airtableRecord, combination, csvToAirtableMapping, linkedTable);
            Object.assign(allDetails, result.details);
            combinationResults.push(result.matches);
        }

        const groupPasses = combinationResults.some(result => result === true);
        groupResults.push(groupPasses);
    }

    const matches = groupResults.every(result => result === true);
    const allScores = Object.values(allDetails).map(detail => detail.similarity);
    const avgScore = allScores.length > 0 ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length : 0;

    return {
        matches,
        score: avgScore,
        details: allDetails
    };
};

const checkFieldCombinationWithMapping = (csvRow, airtableRecord, fieldCombination, csvToAirtableMapping, linkedTable) => {
    if (!fieldCombination.fields || fieldCombination.fields.length === 0) {
        return { matches: false, score: 0, details: {} };
    }

    const details = {};
    const fieldResults = [];

    for (const field of fieldCombination.fields) {
        if (!field.mappedField || !csvToAirtableMapping[field.mappedField]) {
            continue;
        }

        const airtableFieldId = csvToAirtableMapping[field.mappedField];
        const airtableField = linkedTable.getFieldByIdIfExists(airtableFieldId);
        
        if (!airtableField) {
            continue;
        }

        const csvValue = csvRow[field.mappedField];
        const airtableValue = airtableRecord.getCellValueAsString(airtableField);
        
        const similarity = calculateFieldSimilarity(csvValue, airtableValue, field.matchType);
        
        // Determine pass/fail based on field type
        let passes = false;
        if (field.matchType === 'exact') {
            passes = similarity >= 1.0;
        } else {
            passes = similarity >= 0.8;
        }

        details[field.mappedField] = {
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
        matches = fieldResults.every(result => result === true);
    } else {
        matches = fieldResults.some(result => result === true);
    }

    // Calculate average similarity score for display
    const totalSimilarity = Object.values(details).reduce((sum, detail) => sum + detail.similarity, 0);
    const avgScore = totalSimilarity / Object.keys(details).length;

    return {
        matches,
        score: avgScore,
        details
    };
};