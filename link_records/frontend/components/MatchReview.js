import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Button,
    Heading,
    Text,
    FormField,
    Select,
    Switch,
    useLoadable,
    useRecords,
} from '@airtable/blocks/ui';
import { processMatches } from '../utils/matching';

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
    const processingTimeoutRef = useRef(null);

    // Load linked table records properly
    const linkedTableQuery = linkedTable ? linkedTable.selectRecords() : null;
    useLoadable(linkedTableQuery);
    const linkedRecords = useRecords(linkedTableQuery);

    const [fieldMappings, setFieldMappings] = useState({
        exactMatchGroups: [
            {
                id: 1,
                operator: 'OR',
                fieldCombinations: [
                    {
                        id: 11,
                        operator: 'AND',
                        fields: [
                            { csvField: '', airtableField: '', matchType: 'exact' }
                        ]
                    }
                ]
            }
        ],
        fuzzyMatchGroups: [
            {
                id: 1,
                operator: 'AND',
                weight: 1.0,
                fieldCombinations: [
                    {
                        id: 11,
                        operator: 'AND',
                        weight: 0.7,
                        fields: [
                            { csvField: '', airtableField: '', matchType: 'fuzzy' }
                        ]
                    }
                ]
            }
        ],
        enableFuzzyMatching: true
    });

    // Helper to generate unique IDs
    const generateId = () => Date.now() + Math.random();

    // Check if we have valid exact match configuration
    const hasValidExactMatch = () => {
        return fieldMappings.exactMatchGroups.some(group =>
            group.fieldCombinations.some(combo =>
                combo.fields.some(field => field.csvField && field.airtableField)
            )
        );
    };

    // Debug function to inspect matching data
    const debugMatching = (csvData, linkedTable, fieldMappings) => {
        // Use the properly loaded records instead of querying again
        if (!linkedRecords || linkedRecords.length === 0) {
            console.log('No linked records available yet');
            return null;
        }
        
        // Sample the first CSV row and first Airtable record for debugging
        const sampleCsvRow = csvData[0];
        const sampleAirtableRecord = linkedRecords[0];
        
        const debug = {
            csvSample: sampleCsvRow,
            csvHeaders: Object.keys(sampleCsvRow || {}),
            airtableRecordCount: linkedRecords.length,
            airtableFields: linkedTable.fields.map(f => ({ id: f.id, name: f.name, type: f.type })),
            fieldMappings: fieldMappings,
            sampleAirtableRecord: sampleAirtableRecord ? {
                id: sampleAirtableRecord.id,
                primaryField: sampleAirtableRecord.getCellValueAsString(linkedTable.primaryField),
                allFields: linkedTable.fields.map(field => ({
                    name: field.name,
                    value: sampleAirtableRecord.getCellValueAsString(field)
                }))
            } : null
        };
        
        console.log('DEBUG INFO:', debug);
        setDebugInfo(debug);
        
        return debug;
    };

    // Live matching with debugging
    useEffect(() => {
        if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
        }

        // Check if we have the minimum required data
        if (!csvData || !linkedTable || !base || !linkedRecords) {
            console.log('Missing required data for matching:', { 
                csvData: !!csvData, 
                linkedTable: !!linkedTable, 
                base: !!base, 
                linkedRecords: !!linkedRecords 
            });
            setMatches(null);
            setDebugInfo(null);
            return;
        }

        // Check if we have at least one valid exact match configuration
        if (!hasValidExactMatch()) {
            console.log('No valid exact match configuration');
            setMatches(null);
            return;
        }

        setIsProcessing(true);

        processingTimeoutRef.current = setTimeout(() => {
            console.log('Processing matches with field mappings:', fieldMappings);
            try {
                // Add debugging
                const debug = debugMatching(csvData, linkedTable, fieldMappings);
                
                if (debug) {
                    const processedMatches = processMatches(csvData, linkedTable, base, fieldMappings);
                    setMatches(processedMatches);
                    console.log('Live matching results:', processedMatches);
                }
                
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
    }, [csvData, linkedTable, base, fieldMappings, linkedRecords]); // Added linkedRecords to dependencies

    // Get field options for dropdowns
    const csvFieldOptions = [
        { value: '', label: 'Select CSV field...' },
        ...(csvHeaders ? csvHeaders.map(header => ({ value: header, label: header })) : [])
    ];

    const airtableFieldOptions = [
        { value: '', label: 'Select Airtable field...' },
        ...(linkedTable ? linkedTable.fields.map(field => ({
            value: field.id,
            label: `${field.name} (${field.type})`
        })) : [])
    ];

    const matchTypeOptions = [
        { value: 'exact', label: 'Exact' },
        { value: 'fuzzy', label: 'Fuzzy (typos/similar)' },
        { value: 'word', label: 'Word (different order)' },
        { value: 'contains', label: 'Contains' }
    ];

    // Field mapping update functions
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
                            fields: [...combo.fields, { csvField: '', airtableField: '', matchType: 'exact' }]
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
                            fields: [{ csvField: '', airtableField: '', matchType: 'exact' }]
                        }
                    ]
                } : group
            )
        }));
    };

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
                            fields: [...combo.fields, { csvField: '', airtableField: '', matchType: 'fuzzy' }]
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
                            weight: 0.5,
                            fields: [{ csvField: '', airtableField: '', matchType: 'fuzzy' }]
                        }
                    ]
                } : group
            )
        }));
    };

    const moveRecord = (fromCategory, toCategory, index) => {
        setMatches(prev => {
            const newMatches = { ...prev };
            const record = newMatches[fromCategory][index];
            
            // Remove from source category
            newMatches[fromCategory] = newMatches[fromCategory].filter((_, i) => i !== index);
            
            // Add to destination category
            newMatches[toCategory] = [...newMatches[toCategory], record];
            
            return newMatches;
        });
    };

    const processAllChanges = async () => {
        console.log('Processing changes...', { matches, linkedTable, originalRecord, selectedLinkedField });
        
        setProcessing(true);
        
        try {
            // For now, just simulate processing
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // TODO: Implement actual record creation/linking logic
            console.log('Changes processed successfully');
            onComplete();
        } catch (error) {
            console.error('Error processing changes:', error);
            alert(`Error processing changes: ${error.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const canProcess = () => {
        return matches && matches.fuzzy?.length === 0 && hasValidExactMatch();
    };

    const renderRecordCard = (item, index, category) => {
        const record = item.csvRow || item;
        const airtableRecord = item.airtableRecord;
        
        return (
            <Box key={index} padding={3} border="thin" marginBottom={2} borderRadius="4px">
                <Box marginBottom={2}>
                    <Text fontSize="small"><strong>Name:</strong> {record.name || record.Name || 'N/A'}</Text>
                    <Text fontSize="small"><strong>Email:</strong> {record.email || record.Email || 'N/A'}</Text>
                    {record['Health Center'] && (
                        <Text fontSize="small"><strong>Health Center:</strong> {record['Health Center']}</Text>
                    )}
                    {category === 'fuzzy' && item.similarity && (
                        <Text fontSize="small"><strong>Similarity:</strong> {Math.round(item.similarity * 100)}%</Text>
                    )}
                </Box>

                {/* Show field comparison details for fuzzy matches */}
                {category === 'fuzzy' && airtableRecord && item.fieldMatches && (
                    <Box marginTop={2} padding={2} backgroundColor="lightGray2" borderRadius="4px">
                        <Text fontSize="small" fontWeight="strong" marginBottom={2}>Field Comparison:</Text>
                        {Object.entries(item.fieldMatches).map(([csvField, matchInfo]) => (
                            <Box key={csvField} marginBottom={1}>
                                <Text fontSize="small">
                                    <strong>{csvField}:</strong>
                                </Text>
                                <Box display="flex" gap={2} marginLeft={2}>
                                    <Box flex="1">
                                        <Text fontSize="small" textColor="blue">
                                            CSV: "{matchInfo.csvValue || 'N/A'}"
                                        </Text>
                                    </Box>
                                    <Box flex="1">
                                        <Text fontSize="small" textColor="green">
                                            Airtable: "{matchInfo.airtableValue || 'N/A'}"
                                        </Text>
                                    </Box>
                                    <Box width="80px">
                                        <Text fontSize="small" textColor={matchInfo.similarity > 0.8 ? 'green' : matchInfo.similarity > 0.5 ? 'orange' : 'red'}>
                                            {Math.round((matchInfo.similarity || 0) * 100)}% ({matchInfo.matchType})
                                        </Text>
                                    </Box>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                )}

                {/* Simple matched record info for definite matches */}
                {category === 'definite' && airtableRecord && (
                    <Box marginTop={1} padding={2} backgroundColor="lightGray2" borderRadius="4px">
                        <Text fontSize="small" fontWeight="strong">
                            Matched with: {airtableRecord.name}
                        </Text>
                    </Box>
                )}
                
                {/* Action buttons for fuzzy matches */}
                {category === 'fuzzy' && (
                    <Box display="flex" gap={2} marginTop={2}>
                        <Button
                            size="small"
                            onClick={() => moveRecord('fuzzy', 'definite', index)}
                        >
                            ← Exact Match
                        </Button>
                        <Button
                            size="small"
                            onClick={() => moveRecord('fuzzy', 'missing', index)}
                        >
                            Create New →
                        </Button>
                    </Box>
                )}
            </Box>
        );
    };

    return (
        <Box padding={4}>
            <Heading size="large" marginBottom={3}>
                Configure Matching & Review Results
            </Heading>

            <Text marginBottom={4}>
                Configure field matching logic below, then review and categorize the automatically generated matches.
            </Text>

            {/* Debug Information - Show when there are issues */}
            {debugInfo && (
                <Box padding={3} backgroundColor="orange" borderRadius="4px" marginBottom={4}>
                    <Heading size="small" marginBottom={2}>🔍 Debug Information</Heading>
                    <Text fontSize="small" marginBottom={1}><strong>CSV Data:</strong> {csvData?.length || 0} rows</Text>
                    <Text fontSize="small" marginBottom={1}><strong>CSV Headers:</strong> {debugInfo.csvHeaders?.join(', ')}</Text>
                    <Text fontSize="small" marginBottom={1}><strong>Airtable Records:</strong> {debugInfo.airtableRecordCount}</Text>
                    <Text fontSize="small" marginBottom={1}><strong>Has Valid Exact Match:</strong> {hasValidExactMatch() ? 'Yes' : 'No'}</Text>
                    {debugInfo.sampleAirtableRecord && (
                        <Text fontSize="small" marginBottom={1}>
                            <strong>Sample Airtable:</strong> {debugInfo.sampleAirtableRecord.primaryField}
                        </Text>
                    )}
                    <Text fontSize="small" marginBottom={1}>
                        <strong>Available Airtable Fields:</strong> {debugInfo.airtableFields?.map(f => `${f.name} (${f.type})`).join(', ')}
                    </Text>
                    <Text fontSize="small" marginBottom={1}>
                        <strong>Current Field Mappings:</strong> {JSON.stringify(fieldMappings.exactMatchGroups[0]?.fieldCombinations[0]?.fields[0])}
                    </Text>
                    {debugInfo.csvSample && (
                        <Text fontSize="small">
                            <strong>Sample CSV Row:</strong> {JSON.stringify(debugInfo.csvSample)}
                        </Text>
                    )}
                </Box>
            )}

            {/* Matching Configuration Section - Two Columns */}
            <Box display="flex" gap={4} marginBottom={4}>
                {/* Column 1: Exact Match Logic */}
                <Box flex="1">
                    <Box padding={3} border="thick" borderRadius="4px" height="100%">
                        <Heading size="small" marginBottom={3}>
                            Exact Match Logic
                        </Heading>
                        <Text fontSize="small" textColor="light" marginBottom={3}>
                            Configure combinations of fields that must match exactly.
                        </Text>
                        
                        {fieldMappings.exactMatchGroups.map((group, groupIndex) => (
                            <Box key={group.id} marginBottom={3}>
                                {group.fieldCombinations.map((combo, comboIndex) => (
                                    <Box key={combo.id} marginBottom={2} padding={2} border="thin" borderRadius="4px">
                                        <Text fontSize="small" fontWeight="strong" marginBottom={2}>
                                            {comboIndex === 0 ? 'Match if' : 'OR if'} (ALL match):
                                        </Text>
                                        
                                        {combo.fields.map((field, fieldIndex) => (
                                            <Box key={fieldIndex} marginBottom={2}>
                                                <FormField label="CSV Field" marginBottom={1}>
                                                    <Select
                                                        options={csvFieldOptions}
                                                        value={field.csvField}
                                                        onChange={value => updateExactMatchField(group.id, combo.id, fieldIndex, 'csvField', value)}
                                                        size="small"
                                                    />
                                                </FormField>
                                                <FormField label="Airtable Field" marginBottom={1}>
                                                    <Select
                                                        options={airtableFieldOptions}
                                                        value={field.airtableField}
                                                        onChange={value => updateExactMatchField(group.id, combo.id, fieldIndex, 'airtableField', value)}
                                                        size="small"
                                                    />
                                                </FormField>
                                                <FormField label="Match Type" marginBottom={1}>
                                                    <Select
                                                        options={matchTypeOptions}
                                                        value={field.matchType}
                                                        onChange={value => updateExactMatchField(group.id, combo.id, fieldIndex, 'matchType', value)}
                                                        size="small"
                                                    />
                                                </FormField>
                                                <Box display="flex" gap={2}>
                                                    <Button 
                                                        size="small" 
                                                        onClick={() => addExactMatchField(group.id, combo.id)}
                                                    >
                                                        + Field
                                                    </Button>
                                                    {combo.fields.length > 1 && (
                                                        <Button 
                                                            size="small" 
                                                            onClick={() => removeExactMatchField(group.id, combo.id, fieldIndex)}
                                                        >
                                                            ✕
                                                        </Button>
                                                    )}
                                                </Box>
                                            </Box>
                                        ))}
                                    </Box>
                                ))}
                                <Button 
                                    size="small" 
                                    onClick={() => addExactMatchCombination(group.id)}
                                    marginTop={2}
                                >
                                    + Add OR Condition
                                </Button>
                            </Box>
                        ))}
                    </Box>
                </Box>

                {/* Column 2: Fuzzy Match Logic */}
                <Box flex="1">
                    {fieldMappings.enableFuzzyMatching && (
                        <Box padding={3} border="thick" borderRadius="4px" height="100%">
                            <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={3}>
                                <Heading size="small">
                                    Fuzzy Match Logic
                                </Heading>
                                <Box display="flex" alignItems="center" gap={2}>
                                    <Text fontSize="small">Enable Fuzzy Matching</Text>
                                    <Switch
                                        value={fieldMappings.enableFuzzyMatching}
                                        onChange={value => setFieldMappings(prev => ({ ...prev, enableFuzzyMatching: value }))}
                                        ariaLabel="Enable fuzzy matching"
                                    />
                                </Box>
                            </Box>
                            <Text fontSize="small" textColor="light" marginBottom={3}>
                                Configure fields for similarity matching.
                            </Text>
                            
                            {fieldMappings.fuzzyMatchGroups.map((group, groupIndex) => (
                                <Box key={group.id} marginBottom={3}>
                                    {group.fieldCombinations.map((combo, comboIndex) => (
                                        <Box key={combo.id} marginBottom={2} padding={2} border="thin" borderRadius="4px">
                                            <Text fontSize="small" fontWeight="strong" marginBottom={2}>
                                                {comboIndex === 0 ? 'Match if' : 'OR if'} (ALL similar):
                                            </Text>
                                            
                                            {combo.fields.map((field, fieldIndex) => (
                                                <Box key={fieldIndex} marginBottom={2}>
                                                    <FormField label="CSV Field" marginBottom={1}>
                                                        <Select
                                                            options={csvFieldOptions}
                                                            value={field.csvField}
                                                            onChange={value => updateFuzzyMatchField(group.id, combo.id, fieldIndex, 'csvField', value)}
                                                            size="small"
                                                        />
                                                    </FormField>
                                                    <FormField label="Airtable Field" marginBottom={1}>
                                                        <Select
                                                            options={airtableFieldOptions}
                                                            value={field.airtableField}
                                                            onChange={value => updateFuzzyMatchField(group.id, combo.id, fieldIndex, 'airtableField', value)}
                                                            size="small"
                                                        />
                                                    </FormField>
                                                    <FormField label="Match Type" marginBottom={1}>
                                                        <Select
                                                            options={matchTypeOptions}
                                                            value={field.matchType}
                                                            onChange={value => updateFuzzyMatchField(group.id, combo.id, fieldIndex, 'matchType', value)}
                                                            size="small"
                                                        />
                                                    </FormField>
                                                    <Box display="flex" gap={2}>
                                                        <Button 
                                                            size="small" 
                                                            onClick={() => addFuzzyMatchField(group.id, combo.id)}
                                                        >
                                                            + Field
                                                        </Button>
                                                        {combo.fields.length > 1 && (
                                                            <Button 
                                                                size="small" 
                                                                onClick={() => removeFuzzyMatchField(group.id, combo.id, fieldIndex)}
                                                            >
                                                                ✕
                                                            </Button>
                                                        )}
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    ))}
                                    <Button 
                                        size="small" 
                                        onClick={() => addFuzzyMatchCombination(group.id)}
                                        marginTop={2}
                                    >
                                        + Add OR Condition
                                    </Button>
                                </Box>
                            ))}
                        </Box>
                    )}

                    {!fieldMappings.enableFuzzyMatching && (
                        <Box padding={3} border="thick" borderRadius="4px" textAlign="center" height="100%">
                            <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={3}>
                                <Heading size="small">
                                    Fuzzy Match Logic
                                </Heading>
                                <Box display="flex" alignItems="center" gap={2}>
                                    <Text fontSize="small">Enable Fuzzy Matching</Text>
                                    <Switch
                                        value={fieldMappings.enableFuzzyMatching}
                                        onChange={value => setFieldMappings(prev => ({ ...prev, enableFuzzyMatching: value }))}
                                        ariaLabel="Enable fuzzy matching"
                                    />
                                </Box>
                            </Box>
                            <Box display="flex" alignItems="center" justifyContent="center" height="200px">
                                <Text fontSize="small" textColor="light">
                                    Fuzzy matching is disabled. Only exact matches will be found.
                                </Text>
                            </Box>
                        </Box>
                    )}
                </Box>

                {/* Column 3: Empty for this row */}
                <Box flex="1">
                </Box>
            </Box>

            {/* Live Results Preview */}
            {isProcessing && (
                <Box padding={3} backgroundColor="blue" color="white" borderRadius="4px" marginBottom={4}>
                    <Text>Processing matches... Please wait.</Text>
                </Box>
            )}

            {matches && !isProcessing && (
                <Box padding={3} backgroundColor="lightGray1" borderRadius="4px" marginBottom={4}>
                    <Heading size="small" marginBottom={2}>Live Matching Results</Heading>
                    <Text>• {matches.definite?.length || 0} exact matches</Text>
                    <Text>• {matches.fuzzy?.length || 0} fuzzy matches (need review)</Text>
                    <Text>• {matches.missing?.length || 0} records to create</Text>
                </Box>
            )}

            {csvData && !matches && !isProcessing && !hasValidExactMatch() && (
                <Box padding={3} backgroundColor="orange" color="white" borderRadius="4px" marginBottom={4}>
                    <Text>⚠️ Configure at least one exact match field to enable processing.</Text>
                </Box>
            )}

            {/* Results Review Section - Three Columns */}
            {matches && (
                <Box marginBottom={4}>
                    <Heading size="medium" marginBottom={3}>
                        Review & Categorize Matches
                    </Heading>

                    <Box display="flex" gap={4}>
                        {/* Column 1: Exact Matches */}
                        <Box flex="1">
                            <Box padding={3} border="thick" borderRadius="4px" backgroundColor="lightGray1">
                                <Heading size="small" marginBottom={2} textColor="green">
                                    ✅ Exact Matches ({matches.definite?.length || 0})
                                </Heading>
                                <Text fontSize="small" marginBottom={3}>
                                    These will be automatically linked:
                                </Text>
                                
                                <Box maxHeight="300px" overflow="auto">
                                    {matches.definite?.length > 0 ? (
                                        matches.definite.map((item, index) => renderRecordCard(item, index, 'definite'))
                                    ) : (
                                        <Box padding={3} textAlign="center" backgroundColor="white" borderRadius="4px">
                                            <Text fontSize="small" textColor="light">No exact matches found</Text>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Box>

                        {/* Column 2: Fuzzy Matches */}
                        <Box flex="1">
                            <Box padding={3} border="thick" borderRadius="4px" backgroundColor="orange" color="white">
                                <Heading size="small" marginBottom={2}>
                                    ⚠️ Fuzzy Matches ({matches.fuzzy?.length || 0})
                                </Heading>
                                <Text fontSize="small" marginBottom={3}>
                                    Review and categorize these:
                                </Text>
                                
                                <Box maxHeight="300px" overflow="auto">
                                    {matches.fuzzy?.length > 0 ? (
                                        matches.fuzzy.map((item, index) => renderRecordCard(item, index, 'fuzzy'))
                                    ) : (
                                        <Box padding={3} textAlign="center" backgroundColor="white" borderRadius="4px">
                                            <Text fontSize="small" textColor="black">No fuzzy matches found</Text>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Box>

                        {/* Column 3: Records to Create */}
                        <Box flex="1">
                            <Box padding={3} border="thick" borderRadius="4px" backgroundColor="lightGray1">
                                <Heading size="small" marginBottom={2} textColor="blue">
                                    ➕ Records to Create ({matches.missing?.length || 0})
                                </Heading>
                                <Text fontSize="small" marginBottom={3}>
                                    These will be created as new records:
                                </Text>
                                
                                <Box maxHeight="300px" overflow="auto">
                                    {matches.missing?.length > 0 ? (
                                        matches.missing.map((item, index) => renderRecordCard(item, index, 'missing'))
                                    ) : (
                                        <Box padding={3} textAlign="center" backgroundColor="white" borderRadius="4px">
                                            <Text fontSize="small" textColor="light">No new records to create</Text>
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    </Box>

                    {/* Summary */}
                    <Box marginTop={4} padding={3} backgroundColor="lightGray1" borderRadius="4px">
                        <Heading size="small" marginBottom={2}>Summary</Heading>
                        <Text>• {matches.definite?.length || 0} records will be linked (exact matches)</Text>
                        <Text>• {matches.fuzzy?.length || 0} records still need review (fuzzy matches)</Text>
                        <Text>• {matches.missing?.length || 0} new records will be created</Text>
                        
                        {!canProcess() && matches.fuzzy?.length > 0 && (
                            <Box marginTop={2} padding={2} backgroundColor="orange" color="white" borderRadius="4px">
                                <Text fontSize="small">
                                    ⚠️ You must resolve all fuzzy matches before proceeding. 
                                    Use the buttons to move them to either "Exact Matches" or "Records to Create".
                                </Text>
                            </Box>
                        )}
                        
                        {!canProcess() && !hasValidExactMatch() && (
                            <Box marginTop={2} padding={2} backgroundColor="orange" color="white" borderRadius="4px">
                                <Text fontSize="small">
                                    ⚠️ Configure at least one exact match field before proceeding.
                                </Text>
                            </Box>
                        )}
                        
                        {canProcess() && (
                            <Box marginTop={2} padding={2} backgroundColor="green" color="white" borderRadius="4px">
                                <Text fontSize="small">
                                    ✅ All matches have been reviewed! Ready to process.
                                </Text>
                            </Box>
                        )}
                    </Box>

                    {processing && (
                        <Box marginTop={4} padding={3} backgroundColor="blue" color="white" borderRadius="4px">
                            <Text>Processing changes... Please wait.</Text>
                        </Box>
                    )}
                </Box>
            )}

            {/* Navigation */}
            <Box display="flex" justifyContent="space-between">
                <Button onClick={onBack} disabled={processing}>
                    Back to Setup
                </Button>
                
                {matches && (
                    <Button
                        variant="primary"
                        onClick={processAllChanges}
                        disabled={processing || !canProcess()}
                    >
                        {processing ? 'Processing...' : `Apply Changes (${matches.definite?.length || 0} links, ${matches.missing?.length || 0} new)`}
                    </Button>
                )}
            </Box>
        </Box>
    );
}

export default MatchReview;