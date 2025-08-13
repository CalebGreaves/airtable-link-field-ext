import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Button,
    Heading,
    Text,
    FormField,
    Select,
    Switch,
} from '@airtable/blocks/ui';
import { processMatches } from '../utils/matching';

function CsvUpload({ onUpload, onBack, linkedTable, base }) {
    const [csvData, setCsvData] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [rows, setRows] = useState([]);
    const [error, setError] = useState('');
    const [matches, setMatches] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [fieldMappings, setFieldMappings] = useState({
        exactMatchGroups: [
            {
                id: 1,
                operator: 'OR', // OR means any of these field combinations can trigger an exact match
                fieldCombinations: [
                    {
                        id: 11,
                        operator: 'AND', // AND means all fields in this combination must match
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
                operator: 'AND', // AND means all field combinations must match for fuzzy matching
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
    const fileInputRef = useRef(null);
    const processingTimeoutRef = useRef(null);

    // Helper to generate unique IDs
    const generateId = () => Date.now() + Math.random();

    // Improved CSV parsing function that handles edge cases
    const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    };

    const parseCSV = (csvText) => {
        try {
            const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            const lines = normalizedText.split('\n').filter(line => line.trim() !== '');
            
            if (lines.length === 0) {
                throw new Error('CSV is empty');
            }

            const parsedHeaders = parseCSVLine(lines[0]);
            console.log('Parsed headers:', parsedHeaders);
            
            const parsedRows = [];
            let skippedRows = 0;
            
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line === '') continue;
                
                const cells = parseCSVLine(line);
                const rowObject = {};
                let hasData = false;
                
                parsedHeaders.forEach((header, index) => {
                    const cellValue = cells[index] || '';
                    rowObject[header] = cellValue;
                    if (cellValue.trim() !== '') {
                        hasData = true;
                    }
                });
                
                if (hasData) {
                    parsedRows.push(rowObject);
                } else {
                    skippedRows++;
                }
            }

            console.log(`Parsed ${parsedRows.length} rows, skipped ${skippedRows} empty rows`);
            
            setHeaders(parsedHeaders);
            setRows(parsedRows);
            setCsvData(parsedRows);
            setError('');
            setMatches(null);
            
        } catch (err) {
            console.error('CSV parsing error:', err);
            setError(`Error parsing CSV: ${err.message}`);
            setHeaders([]);
            setRows([]);
            setCsvData(null);
            setMatches(null);
        }
    };

    // Check if we have valid exact match configuration
    const hasValidExactMatch = () => {
        return fieldMappings.exactMatchGroups.some(group =>
            group.fieldCombinations.some(combo =>
                combo.fields.some(field => field.csvField && field.airtableField)
            )
        );
    };

    // Live matching with better error handling
    useEffect(() => {
        if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current);
        }

        // Check if we have the minimum required data
        if (!csvData || !linkedTable || !base) {
            setMatches(null);
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
                const processedMatches = processMatches(csvData, linkedTable, base, fieldMappings);
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
    }, [csvData, linkedTable, base, fieldMappings]);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            setError('Please select a CSV file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const csvText = e.target.result;
            parseCSV(csvText);
        };
        reader.readAsText(file);
    };

    const handleTextAreaPaste = (event) => {
        const csvText = event.target.value;
        if (csvText.trim()) {
            parseCSV(csvText);
        }
    };

    const clearData = () => {
        setCsvData(null);
        setHeaders([]);
        setRows([]);
        setMatches(null);
        setError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Get field options for dropdowns
    const csvFieldOptions = [
        { value: '', label: 'Select CSV field...' },
        ...headers.map(header => ({ value: header, label: header }))
    ];

    const airtableFieldOptions = [
        { value: '', label: 'Select Airtable field...' },
        ...(linkedTable ? linkedTable.fields.map(field => ({
            value: field.id,
            label: field.name
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

    const canProceed = () => {
        return csvData && matches !== null && !isProcessing && hasValidExactMatch();
    };

    const handleProceed = () => {
        if (matches) {
            console.log('Proceeding with matches:', matches);
            onUpload(csvData, fieldMappings, matches);
        }
    };

    return (
        <Box padding={4}>
            <Heading size="large" marginBottom={3}>
                Upload & Configure CSV Matching
            </Heading>
            
            <Text marginBottom={3}>
                Upload CSV data and configure field matching. Results will update automatically as you adjust the settings.
            </Text>

            <Box marginBottom={4}>
                <Box marginBottom={3}>
                    <Text fontWeight="strong" marginBottom={2}>Option 1: Upload CSV File</Text>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        style={{ marginBottom: '12px' }}
                    />
                </Box>

                <Box marginBottom={3}>
                    <Text fontWeight="strong" marginBottom={2}>Option 2: Paste CSV Data</Text>
                    <textarea
                        placeholder="Paste CSV data here..."
                        onChange={handleTextAreaPaste}
                        style={{
                            width: '100%',
                            height: '120px',
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            fontFamily: 'monospace'
                        }}
                    />
                </Box>
            </Box>

            {error && (
                <Box 
                    padding={3} 
                    backgroundColor="red" 
                    color="white" 
                    borderRadius="4px"
                    marginBottom={3}
                >
                    <Text>{error}</Text>
                </Box>
            )}

            {csvData && headers.length > 0 && (
                <>
                    <Box marginBottom={4}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={3}>
                            <Heading size="medium">
                                CSV Preview ({rows.length} total rows found)
                            </Heading>
                            <Button size="small" onClick={clearData}>
                                Clear Data
                            </Button>
                        </Box>
                        
                        <Box maxHeight="200px" overflow="auto" border="thick" borderRadius="4px" marginBottom={4}>
                            <Box backgroundColor="white">
                                <Box display="flex" fontWeight="strong" padding={2} borderBottom="thin">
                                    {headers.map((header, index) => (
                                        <Box key={index} flex="1" paddingRight={2} minWidth="100px">
                                            {header}
                                        </Box>
                                    ))}
                                </Box>
                                {rows.slice(0, 5).map((row, rowIndex) => (
                                    <Box key={rowIndex} display="flex" padding={2} borderBottom="thin">
                                        {headers.map((header, cellIndex) => (
                                            <Box key={cellIndex} flex="1" paddingRight={2} minWidth="100px">
                                                {row[header] || ''}
                                            </Box>
                                        ))}
                                    </Box>
                                ))}
                                {rows.length > 5 && (
                                    <Box padding={2} fontStyle="italic" textColor="light">
                                        ... and {rows.length - 5} more rows
                                    </Box>
                                )}
                            </Box>
                        </Box>
                    </Box>

                    <Heading size="medium" marginBottom={3}>
                        Configure Matching Logic
                    </Heading>

                    {/* Exact Match Configuration */}
                    <Box padding={3} border="thick" borderRadius="4px" marginBottom={3}>
                        <Heading size="small" marginBottom={3}>
                            Exact Match Logic (Definite Matches)
                        </Heading>
                        <Text fontSize="small" textColor="light" marginBottom={3}>
                            Configure combinations of fields that must match exactly. Use OR logic between combinations and AND logic within combinations.
                        </Text>
                        
                        {fieldMappings.exactMatchGroups.map((group, groupIndex) => (
                            <Box key={group.id} marginBottom={3}>
                                {group.fieldCombinations.map((combo, comboIndex) => (
                                    <Box key={combo.id} marginBottom={2} padding={2} border="thin" borderRadius="4px">
                                        <Text fontSize="small" fontWeight="strong" marginBottom={2}>
                                            {comboIndex === 0 ? 'Match if' : 'OR if'} (ALL of these match):
                                        </Text>
                                        
                                        {combo.fields.map((field, fieldIndex) => (
                                            <Box key={fieldIndex} display="flex" gap={3} marginBottom={2} alignItems="end">
                                                <FormField label="CSV Field" flex="1">
                                                    <Select
                                                        options={csvFieldOptions}
                                                        value={field.csvField}
                                                        onChange={value => updateExactMatchField(group.id, combo.id, fieldIndex, 'csvField', value)}
                                                    />
                                                </FormField>
                                                <FormField label="Airtable Field" flex="1">
                                                    <Select
                                                        options={airtableFieldOptions}
                                                        value={field.airtableField}
                                                        onChange={value => updateExactMatchField(group.id, combo.id, fieldIndex, 'airtableField', value)}
                                                    />
                                                </FormField>
                                                <FormField label="Match Type" width="120px">
                                                    <Select
                                                        options={matchTypeOptions}
                                                        value={field.matchType}
                                                        onChange={value => updateExactMatchField(group.id, combo.id, fieldIndex, 'matchType', value)}
                                                    />
                                                </FormField>
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

                    {/* Fuzzy Match Toggle */}
                    <Box marginBottom={3}>
                        <FormField label="Enable Fuzzy Matching">
                            <Switch
                                value={fieldMappings.enableFuzzyMatching}
                                onChange={value => setFieldMappings(prev => ({ ...prev, enableFuzzyMatching: value }))}
                            />
                        </FormField>
                        <Text fontSize="small" textColor="light">
                            Turn off to only use exact matching (all non-exact matches will be marked as missing)
                        </Text>
                    </Box>

                    {/* Fuzzy Match Configuration */}
                    {fieldMappings.enableFuzzyMatching && (
                        <Box padding={3} border="thick" borderRadius="4px" marginBottom={4}>
                            <Heading size="small" marginBottom={3}>
                                Fuzzy Match Logic (Similar Matches)
                            </Heading>
                            <Text fontSize="small" textColor="light" marginBottom={3}>
                                Configure fields for fuzzy matching. Records need to meet the similarity threshold across all configured field combinations.
                            </Text>
                            
                            {fieldMappings.fuzzyMatchGroups.map((group, groupIndex) => (
                                <Box key={group.id} marginBottom={3}>
                                    {group.fieldCombinations.map((combo, comboIndex) => (
                                        <Box key={combo.id} marginBottom={2} padding={2} border="thin" borderRadius="4px">
                                            <Text fontSize="small" fontWeight="strong" marginBottom={2}>
                                                {comboIndex === 0 ? 'Match if' : 'OR if'} (ALL of these match):
                                            </Text>
                                            
                                            {combo.fields.map((field, fieldIndex) => (
                                                <Box key={fieldIndex} display="flex" gap={3} marginBottom={2} alignItems="end">
                                                    <FormField label="CSV Field" flex="1">
                                                        <Select
                                                            options={csvFieldOptions}
                                                            value={field.csvField}
                                                            onChange={value => updateFuzzyMatchField(group.id, combo.id, fieldIndex, 'csvField', value)}
                                                        />
                                                    </FormField>
                                                    <FormField label="Airtable Field" flex="1">
                                                        <Select
                                                            options={airtableFieldOptions}
                                                            value={field.airtableField}
                                                            onChange={value => updateFuzzyMatchField(group.id, combo.id, fieldIndex, 'airtableField', value)}
                                                        />
                                                    </FormField>
                                                    <FormField label="Match Type" width="120px">
                                                        <Select
                                                            options={matchTypeOptions}
                                                            value={field.matchType}
                                                            onChange={value => updateFuzzyMatchField(group.id, combo.id, fieldIndex, 'matchType', value)}
                                                        />
                                                    </FormField>
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

                    {/* Live Results Preview */}
                    {isProcessing && (
                        <Box padding={3} backgroundColor="blue" color="white" borderRadius="4px" marginBottom={3}>
                            <Text>Processing matches... Please wait.</Text>
                        </Box>
                    )}

                    {matches && !isProcessing && (
                        <Box padding={3} backgroundColor="lightGray1" borderRadius="4px" marginBottom={4}>
                            <Heading size="small" marginBottom={2}>Live Matching Results</Heading>
                            <Text>• {matches.definite?.length || 0} definite matches (exact matches)</Text>
                            <Text>• {matches.fuzzy?.length || 0} fuzzy matches (need review)</Text>
                            <Text>• {matches.missing?.length || 0} missing records (will be created)</Text>
                            <Text fontSize="small" textColor="light" marginTop={2}>
                                Results update automatically as you change field mappings above.
                            </Text>
                        </Box>
                    )}

                    {csvData && !matches && !isProcessing && !hasValidExactMatch() && (
                        <Box padding={3} backgroundColor="orange" color="white" borderRadius="4px" marginBottom={4}>
                            <Text>⚠️ Configure at least one exact match field to enable processing.</Text>
                        </Box>
                    )}
                </>
            )}

            <Box display="flex" justifyContent="space-between">
                <Button onClick={onBack}>
                    Back
                </Button>
                
                <Button
                    variant="primary"
                    disabled={!canProceed()}
                    onClick={handleProceed}
                >
                    {!canProceed() && !isProcessing ? 
                        'Configure Matching Fields' : 
                        `Review Matches (${csvData ? csvData.length : 0} rows)`
                    }
                </Button>
            </Box>
        </Box>
    );
}

export default CsvUpload;