import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Button,
    Heading,
    Text,
    useLoadable,
    useRecords,
} from '@airtable/blocks/ui';
import { processMatchesWithMapping } from '../utils/matching';
import FieldMapping from './FieldMapping';
import MatchingLogic from './MatchingLogic';
import MatchResults from './MatchResults';

function MatchReview({ 
    csvData, 
    csvHeaders, 
    linkedTable, 
    originalRecord, 
    selectedLinkedField, 
    onComplete, 
    onBack, 
    base 
}) {
    const [matches, setMatches] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [debugInfo, setDebugInfo] = useState(null);
    const [autoProcessing, setAutoProcessing] = useState(true);
    const processingTimeoutRef = useRef(null);

    // Load linked table records
    const linkedTableQuery = linkedTable ? linkedTable.selectRecords() : null;
    useLoadable(linkedTableQuery);
    const linkedRecords = useRecords(linkedTableQuery);

    // Updated field mappings state structure
    const [fieldMappings, setFieldMappings] = useState({
        csvToAirtable: {}, // { csvField: airtableFieldId }
        exactMatchGroups: [
            {
                id: 1,
                operator: 'OR',
                fieldCombinations: [
                    {
                        id: 11,
                        operator: 'AND',
                        fields: [
                            { mappedField: '', matchType: 'exact' }
                        ]
                    }
                ]
            }
        ],
        fuzzyMatchGroups: [
            {
                id: 1,
                operator: 'AND',
                fieldCombinations: [
                    {
                        id: 11,
                        operator: 'AND',
                        fields: [
                            { mappedField: '', matchType: 'fuzzy' }
                        ]
                    }
                ]
            }
        ],
        enableFuzzyMatching: true
    });

    // Helper functions
    const generateId = () => Date.now() + Math.random();

    const hasValidExactMatch = () => {
        return fieldMappings.exactMatchGroups.some(group =>
            group.fieldCombinations.some(combo =>
                combo.fields.some(field => field.mappedField && fieldMappings.csvToAirtable[field.mappedField])
            )
        );
    };

    // Field mapping functions
    const updateFieldMapping = (csvField, airtableFieldId) => {
        setFieldMappings(prev => ({
            ...prev,
            csvToAirtable: {
                ...prev.csvToAirtable,
                [csvField]: airtableFieldId
            }
        }));
    };

    const removeFieldMapping = (csvField) => {
        setFieldMappings(prev => {
            const newMappings = { ...prev.csvToAirtable };
            delete newMappings[csvField];
            return {
                ...prev,
                csvToAirtable: newMappings
            };
        });
    };

    // Exact match field functions
    const updateExactMatchField = (groupId, comboId, fieldIndex, property, value) => {
        setFieldMappings(prev => ({
            ...prev,
            exactMatchGroups: prev.exactMatchGroups.map(group =>
                group.id === groupId ? {
                    ...group,
                    fieldCombinations: group.fieldCombinations.map(combo =>
                        combo.id === comboId ? {
                            ...combo,
                            fields: combo.fields.map((field, idx) =>
                                idx === fieldIndex ? { ...field, [property]: value } : field
                            )
                        } : combo
                    )
                } : group
            )
        }));
    };

    const addExactMatchField = (groupId, comboId) => {
        setFieldMappings(prev => ({
            ...prev,
            exactMatchGroups: prev.exactMatchGroups.map(group =>
                group.id === groupId ? {
                    ...group,
                    fieldCombinations: group.fieldCombinations.map(combo =>
                        combo.id === comboId ? {
                            ...combo,
                            fields: [...combo.fields, { mappedField: '', matchType: 'exact' }]
                        } : combo
                    )
                } : group
            )
        }));
    };

    const removeExactMatchField = (groupId, comboId, fieldIndex) => {
        setFieldMappings(prev => ({
            ...prev,
            exactMatchGroups: prev.exactMatchGroups.map(group =>
                group.id === groupId ? {
                    ...group,
                    fieldCombinations: group.fieldCombinations.map(combo =>
                        combo.id === comboId ? {
                            ...combo,
                            fields: combo.fields.filter((_, idx) => idx !== fieldIndex)
                        } : combo
                    )
                } : group
            )
        }));
    };

    const addExactMatchCombination = (groupId) => {
        setFieldMappings(prev => ({
            ...prev,
            exactMatchGroups: prev.exactMatchGroups.map(group =>
                group.id === groupId ? {
                    ...group,
                    fieldCombinations: [
                        ...group.fieldCombinations,
                        {
                            id: generateId(),
                            operator: 'AND',
                            fields: [{ mappedField: '', matchType: 'exact' }]
                        }
                    ]
                } : group
            )
        }));
    };

    const removeExactMatchCombination = (groupId, comboId) => {
        setFieldMappings(prev => ({
            ...prev,
            exactMatchGroups: prev.exactMatchGroups.map(group =>
                group.id === groupId ? {
                    ...group,
                    fieldCombinations: group.fieldCombinations.filter(combo => combo.id !== comboId)
                } : group
            )
        }));
    };

    // Fuzzy match field functions
    const updateFuzzyMatchField = (groupId, comboId, fieldIndex, property, value) => {
        setFieldMappings(prev => ({
            ...prev,
            fuzzyMatchGroups: prev.fuzzyMatchGroups.map(group =>
                group.id === groupId ? {
                    ...group,
                    fieldCombinations: group.fieldCombinations.map(combo =>
                        combo.id === comboId ? {
                            ...combo,
                            fields: combo.fields.map((field, idx) =>
                                idx === fieldIndex ? { ...field, [property]: value } : field
                            )
                        } : combo
                    )
                } : group
            )
        }));
    };

    const addFuzzyMatchField = (groupId, comboId) => {
        setFieldMappings(prev => ({
            ...prev,
            fuzzyMatchGroups: prev.fuzzyMatchGroups.map(group =>
                group.id === groupId ? {
                    ...group,
                    fieldCombinations: group.fieldCombinations.map(combo =>
                        combo.id === comboId ? {
                            ...combo,
                            fields: [...combo.fields, { mappedField: '', matchType: 'fuzzy' }]
                        } : combo
                    )
                } : group
            )
        }));
    };

    const removeFuzzyMatchField = (groupId, comboId, fieldIndex) => {
        setFieldMappings(prev => ({
            ...prev,
            fuzzyMatchGroups: prev.fuzzyMatchGroups.map(group =>
                group.id === groupId ? {
                    ...group,
                    fieldCombinations: group.fieldCombinations.map(combo =>
                        combo.id === comboId ? {
                            ...combo,
                            fields: combo.fields.filter((_, idx) => idx !== fieldIndex)
                        } : combo
                    )
                } : group
            )
        }));
    };

    const addFuzzyMatchCombination = (groupId) => {
        setFieldMappings(prev => ({
            ...prev,
            fuzzyMatchGroups: prev.fuzzyMatchGroups.map(group =>
                group.id === groupId ? {
                    ...group,
                    fieldCombinations: [
                        ...group.fieldCombinations,
                        {
                            id: generateId(),
                            operator: 'AND',
                            fields: [{ mappedField: '', matchType: 'fuzzy' }]
                        }
                    ]
                } : group
            )
        }));
    };

    const removeFuzzyMatchCombination = (groupId, comboId) => {
        setFieldMappings(prev => ({
            ...prev,
            fuzzyMatchGroups: prev.fuzzyMatchGroups.map(group =>
                group.id === groupId ? {
                    ...group,
                    fieldCombinations: group.fieldCombinations.filter(combo => combo.id !== comboId)
                } : group
            )
        }));
    };

    // Move record between categories
    const moveRecord = (fromCategory, toCategory, index) => {
        console.log(`Moving record from ${fromCategory} to ${toCategory} at index ${index}`);
        setAutoProcessing(false);
        
        setMatches(prev => {
            if (!prev || !prev[fromCategory] || !prev[fromCategory][index]) {
                console.error('Invalid move operation:', { prev, fromCategory, toCategory, index });
                return prev;
            }
            
            const newMatches = { ...prev };
            const record = { ...newMatches[fromCategory][index] };
            
            if (toCategory === 'definite') {
                record.matchType = 'exact';
            } else if (toCategory === 'missing') {
                delete record.airtableRecord;
                delete record.similarity;
                delete record.fieldMatches;
                delete record.matchType;
            }
            
            newMatches[fromCategory] = newMatches[fromCategory].filter((_, i) => i !== index);
            newMatches[toCategory] = [...newMatches[toCategory], record];
            
            return newMatches;
        });
    };

    // Re-enable auto-processing
    const reprocessMatches = () => {
        setAutoProcessing(true);
        setMatches(null);
    };

    // Check if processing is allowed
    const canProcess = () => {
        const hasValidExact = hasValidExactMatch();
        const noFuzzyMatches = !matches?.fuzzy || matches.fuzzy.length === 0;
        return hasValidExact && noFuzzyMatches;
    };

    // Process all changes
    const processAllChanges = async () => {
        console.log('Processing changes...', { matches, linkedTable, originalRecord, selectedLinkedField });
        
        setProcessing(true);
        
        try {
            const recordsToLink = [];
            
            // Create new records for missing items
            if (matches.missing && matches.missing.length > 0) {
                console.log(`Creating ${matches.missing.length} new records...`);
                
                for (const missingItem of matches.missing) {
                    const record = missingItem.csvRow || missingItem;
                    const newRecordFields = {};
                    
                    // Use field mappings to create new record
                    Object.entries(fieldMappings.csvToAirtable).forEach(([csvField, airtableFieldId]) => {
                        if (record[csvField] && record[csvField].trim() !== '') {
                            const airtableField = linkedTable.getFieldByIdIfExists(airtableFieldId);
                            if (airtableField) {
                                let value = record[csvField].trim();
                                
                                switch (airtableField.type) {
                                    case 'email':
                                        if (value.includes('@')) {
                                            newRecordFields[airtableFieldId] = value;
                                        }
                                        break;
                                    case 'number':
                                        const numValue = parseFloat(value);
                                        if (!isNaN(numValue)) {
                                            newRecordFields[airtableFieldId] = numValue;
                                        }
                                        break;
                                    case 'checkbox':
                                        newRecordFields[airtableFieldId] = ['true', 'yes', '1'].includes(value.toLowerCase());
                                        break;
                                    default:
                                        newRecordFields[airtableFieldId] = value;
                                }
                            }
                        }
                    });
                    
                    // Ensure primary field has a value
                    if (!newRecordFields[linkedTable.primaryField.id]) {
                        const nameValue = record.name || record.Name || record.firstName || record['First Name'] || 'Unknown';
                        newRecordFields[linkedTable.primaryField.id] = nameValue;
                    }
                    
                    try {
                        const newRecordId = await linkedTable.createRecordAsync(newRecordFields);
                        recordsToLink.push(newRecordId);
                        console.log(`Created new record: ${newRecordId}`);
                    } catch (error) {
                        console.error('Error creating record:', error, 'Fields:', newRecordFields);
                        throw new Error(`Failed to create record: ${error.message}`);
                    }
                }
            }
            
            // Add existing matched records
            if (matches.definite && matches.definite.length > 0) {
                console.log(`Adding ${matches.definite.length} existing records...`);
                for (const definiteMatch of matches.definite) {
                    if (definiteMatch.airtableRecord && definiteMatch.airtableRecord.id) {
                        recordsToLink.push(definiteMatch.airtableRecord.id);
                    }
                }
            }
            
            // Link all records to the original record
            if (recordsToLink.length > 0) {
                console.log(`Linking ${recordsToLink.length} records to original record...`);
                
                const currentLinkedRecords = originalRecord.getCellValue(selectedLinkedField) || [];
                const currentLinkedIds = currentLinkedRecords.map(record => record.id);
                const allLinkedIds = [...new Set([...currentLinkedIds, ...recordsToLink])];
                
                await originalRecord.updateCellAsync(selectedLinkedField, 
                    allLinkedIds.map(id => ({ id }))
                );
                
                console.log(`Successfully linked ${allLinkedIds.length} total records`);
            }
            
            const summary = {
                created: matches.missing?.length || 0,
                linked: matches.definite?.length || 0,
                total: recordsToLink.length
            };
            
            console.log('Processing complete:', summary);
            alert(`Success! Created ${summary.created} new records and linked ${summary.total} total records.`);
            
            onComplete();
            
        } catch (error) {
            console.error('Error processing changes:', error);
            alert(`Error processing changes: ${error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    // Auto-processing effect
    useEffect(() => {
        if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
        }

        if (!autoProcessing) {
            console.log('Auto-processing disabled - user has manually modified matches');
            return;
        }

        if (!csvData || !linkedTable || !base || !linkedRecords) {
            console.log('Missing required data for matching');
            setMatches(null);
            setDebugInfo(null);
            return;
        }

        if (Object.keys(fieldMappings.csvToAirtable).length === 0 || !hasValidExactMatch()) {
            console.log('No field mappings or valid exact match configuration');
            setMatches(null);
            return;
        }

        setIsProcessing(true);

        processingTimeoutRef.current = setTimeout(() => {
            console.log('Processing matches with field mappings:', fieldMappings);
            try {
                const processedMatches = processMatchesWithMapping(csvData, linkedTable, base, fieldMappings);
                setMatches(processedMatches);
                console.log('Live matching results:', processedMatches);
            } catch (error) {
                console.error('Error during live matching:', error);
                setMatches(null);
            } finally {
                setIsProcessing(false);
            }
        }, 500);

        return () => {
            if (processingTimeoutRef.current) {
                clearTimeout(processingTimeoutRef.current);
            }
        };
    }, [csvData, linkedTable, base, fieldMappings, linkedRecords, autoProcessing]);

    return (
        <Box padding={4}>
            <Heading size="large" marginBottom={3}>
                Configure Field Mapping & Matching Logic
            </Heading>

            <Text marginBottom={4}>
                First map your CSV fields to Airtable fields, then configure matching logic, and finally review results.
            </Text>

            {/* 1. Field Mapping Section */}
            <FieldMapping
                csvHeaders={csvHeaders}
                linkedTable={linkedTable}
                fieldMappings={fieldMappings}
                updateFieldMapping={updateFieldMapping}
                removeFieldMapping={removeFieldMapping}
                csvData={csvData}
            />

            {/* Progress indicator */}
            {Object.keys(fieldMappings.csvToAirtable).length === 0 && (
                <Box padding={3} backgroundColor="orange" color="white" borderRadius="4px" marginBottom={4}>
                    <Text>⚠️ Map at least one CSV field to an Airtable field to proceed with matching.</Text>
                </Box>
            )}

            {/* 2. Matching Logic Section */}
            {Object.keys(fieldMappings.csvToAirtable).length > 0 && (
                <MatchingLogic
                    fieldMappings={fieldMappings}
                    linkedTable={linkedTable}
                    updateExactMatchField={updateExactMatchField}
                    addExactMatchField={addExactMatchField}
                    removeExactMatchField={removeExactMatchField}
                    addExactMatchCombination={addExactMatchCombination}
                    removeExactMatchCombination={removeExactMatchCombination}
                    updateFuzzyMatchField={updateFuzzyMatchField}
                    addFuzzyMatchField={addFuzzyMatchField}
                    removeFuzzyMatchField={removeFuzzyMatchField}
                    addFuzzyMatchCombination={addFuzzyMatchCombination}
                    removeFuzzyMatchCombination={removeFuzzyMatchCombination}
                    setFieldMappings={setFieldMappings}
                    generateId={generateId}
                />
            )}

            {/* Re-process button */}
            {matches && !autoProcessing && (
                <Box padding={3} backgroundColor="orange" borderRadius="4px" marginBottom={4}>
                    <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Text color="white">Auto-processing disabled after manual changes.</Text>
                        <Button size="small" onClick={reprocessMatches} backgroundColor="white" textColor="orange">
                            Re-run Matching
                        </Button>
                    </Box>
                </Box>
            )}

            {/* Processing indicator */}
            {isProcessing && (
                <Box padding={3} backgroundColor="blue" color="white" borderRadius="4px" marginBottom={4}>
                    <Text>Processing matches... Please wait.</Text>
                </Box>
            )}

            {/* Live results preview */}
            {matches && !isProcessing && (
                <Box padding={3} backgroundColor="lightGray1" borderRadius="4px" marginBottom={4}>
                    <Heading size="small" marginBottom={2}>Live Matching Results</Heading>
                    <Text>• {matches.definite?.length || 0} exact matches</Text>
                    <Text>• {matches.fuzzy?.length || 0} fuzzy matches (need review)</Text>
                    <Text>• {matches.missing?.length || 0} records to create</Text>
                </Box>
            )}

            {/* 3. Results Review Section */}
            {matches && (
                <MatchResults
                    matches={matches}
                    moveRecord={moveRecord}
                    canProcess={canProcess}
                    hasValidExactMatch={hasValidExactMatch}
                />
            )}

            {/* Navigation */}
            <Box display="flex" justifyContent="space-between">
                <Button onClick={onBack} disabled={processing}>
                    Back to Setup
                </Button>
                
                {matches && canProcess() && (
                    <Button
                        variant="primary"
                        onClick={processAllChanges}
                        disabled={processing}
                    >
                        {processing ? 'Processing...' : `Apply Changes (${matches.definite?.length || 0} links, ${matches.missing?.length || 0} new)`}
                    </Button>
                )}
            </Box>
        </Box>
    );
}

export default MatchReview;