import React, { useState, useRef } from 'react';
import {
    Box,
    Button,
    Heading,
    Text,
    FormField,
    Select,
} from '@airtable/blocks/ui';

function CsvUpload({ onUpload, onBack, linkedTable }) {
    const [csvData, setCsvData] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [rows, setRows] = useState([]);
    const [error, setError] = useState('');
    const [fieldMappings, setFieldMappings] = useState({
        exactMatchField: { csvField: '', airtableField: '' },
        fuzzyMatchFields: [
            { csvField: '', airtableField: '', weight: 0.7 },
            { csvField: '', airtableField: '', weight: 0.3 }
        ]
    });
    const fileInputRef = useRef(null);

    const parseCSV = (csvText) => {
        try {
            const lines = csvText.split('\n');
            if (lines.length === 0) {
                throw new Error('CSV is empty');
            }

            const headerLine = lines[0].replace(/\r$/, '');
            const parsedHeaders = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
            
            const parsedRows = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].replace(/\r$/, '');
                if (line.trim() === '') continue;
                
                const cells = line.split(',').map(cell => cell.trim().replace(/"/g, ''));
                if (cells.length === parsedHeaders.length) {
                    const rowObject = {};
                    parsedHeaders.forEach((header, index) => {
                        rowObject[header] = cells[index];
                    });
                    parsedRows.push(rowObject);
                }
            }

            setHeaders(parsedHeaders);
            setRows(parsedRows);
            setCsvData(parsedRows);
            setError('');
        } catch (err) {
            setError(`Error parsing CSV: ${err.message}`);
            setHeaders([]);
            setRows([]);
            setCsvData(null);
        }
    };

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

    const updateExactMatchMapping = (type, value) => {
        setFieldMappings(prev => ({
            ...prev,
            exactMatchField: {
                ...prev.exactMatchField,
                [type]: value
            }
        }));
    };

    const updateFuzzyMatchMapping = (index, type, value) => {
        setFieldMappings(prev => ({
            ...prev,
            fuzzyMatchFields: prev.fuzzyMatchFields.map((field, i) => 
                i === index ? { ...field, [type]: value } : field
            )
        }));
    };

    const canProceed = () => {
        return csvData && 
               fieldMappings.exactMatchField.csvField && 
               fieldMappings.exactMatchField.airtableField &&
               fieldMappings.fuzzyMatchFields.some(f => f.csvField && f.airtableField);
    };

    const handleProceed = () => {
        onUpload(csvData, fieldMappings);
    };

    return (
        <Box padding={4}>
            <Heading size="large" marginBottom={3}>
                Upload CSV Data
            </Heading>
            
            <Text marginBottom={3}>
                Upload a CSV file or paste CSV data containing participant information.
                Then configure how the CSV fields should be matched against the Airtable fields.
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
                                Preview ({rows.length} rows)
                            </Heading>
                            <Button size="small" onClick={clearData}>
                                Clear Data
                            </Button>
                        </Box>
                        
                        <Box maxHeight="200px" overflow="auto" border="thick" borderRadius="4px" marginBottom={4}>
                            <Box backgroundColor="white">
                                <Box display="flex" fontWeight="strong" padding={2} borderBottom="thin">
                                    {headers.map((header, index) => (
                                        <Box key={index} flex="1" paddingRight={2}>
                                            {header}
                                        </Box>
                                    ))}
                                </Box>
                                {rows.slice(0, 5).map((row, rowIndex) => (
                                    <Box key={rowIndex} display="flex" padding={2} borderBottom="thin">
                                        {headers.map((header, cellIndex) => (
                                            <Box key={cellIndex} flex="1" paddingRight={2}>
                                                {row[header] || ''}
                                            </Box>
                                        ))}
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Box>

                    <Heading size="medium" marginBottom={3}>
                        Configure Field Matching
                    </Heading>

                    {/* Exact Match Configuration */}
                    <Box padding={3} border="thick" borderRadius="4px" marginBottom={3}>
                        <Heading size="small" marginBottom={3}>
                            Exact Match Fields (for definite matches)
                        </Heading>
                        <Text fontSize="small" textColor="light" marginBottom={3}>
                            Records will be considered definite matches if these fields are exactly the same.
                        </Text>
                        
                        <Box display="flex" gap={3}>
                            <FormField label="CSV Field" flex="1">
                                <Select
                                    options={csvFieldOptions}
                                    value={fieldMappings.exactMatchField.csvField}
                                    onChange={value => updateExactMatchMapping('csvField', value)}
                                />
                            </FormField>
                            <FormField label="Airtable Field" flex="1">
                                <Select
                                    options={airtableFieldOptions}
                                    value={fieldMappings.exactMatchField.airtableField}
                                    onChange={value => updateExactMatchMapping('airtableField', value)}
                                />
                            </FormField>
                        </Box>
                    </Box>

                    {/* Fuzzy Match Configuration */}
                    <Box padding={3} border="thick" borderRadius="4px" marginBottom={4}>
                        <Heading size="small" marginBottom={3}>
                            Fuzzy Match Fields (for similar matches)
                        </Heading>
                        <Text fontSize="small" textColor="light" marginBottom={3}>
                            Records will be considered fuzzy matches if these fields are similar. 
                            Higher weights are more important for matching.
                        </Text>
                        
                        {fieldMappings.fuzzyMatchFields.map((fuzzyField, index) => (
                            <Box key={index} display="flex" gap={3} marginBottom={2}>
                                <FormField label={`CSV Field ${index + 1}`} flex="1">
                                    <Select
                                        options={csvFieldOptions}
                                        value={fuzzyField.csvField}
                                        onChange={value => updateFuzzyMatchMapping(index, 'csvField', value)}
                                    />
                                </FormField>
                                <FormField label={`Airtable Field ${index + 1}`} flex="1">
                                    <Select
                                        options={airtableFieldOptions}
                                        value={fuzzyField.airtableField}
                                        onChange={value => updateFuzzyMatchMapping(index, 'airtableField', value)}
                                    />
                                </FormField>
                                <FormField label="Weight" width="80px">
                                    <Select
                                        options={[
                                            { value: 0.1, label: '10%' },
                                            { value: 0.3, label: '30%' },
                                            { value: 0.5, label: '50%' },
                                            { value: 0.7, label: '70%' },
                                            { value: 0.9, label: '90%' }
                                        ]}
                                        value={fuzzyField.weight}
                                        onChange={value => updateFuzzyMatchMapping(index, 'weight', value)}
                                    />
                                </FormField>
                            </Box>
                        ))}
                    </Box>
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
                    Process Matches ({csvData ? csvData.length : 0} rows)
                </Button>
            </Box>
        </Box>
    );
}

export default CsvUpload;