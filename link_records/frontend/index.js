import {initializeBlock, expandRecordPickerAsync} from '@airtable/blocks/ui';
import React, {useState, useEffect, useRef} from 'react';
import {
    Box,
    Button,
    FormField,
    Heading,
    TablePicker,
    FieldPicker,
    Text,
    useBase,
    useRecords,
    useLoadable,
} from '@airtable/blocks/ui';
import './style.css';

// Import our custom components
import MatchReview from './components/MatchReview';
import { processMatches } from './utils/matching';

function LinkRecordsApp() {
    const base = useBase();
    const [currentStep, setCurrentStep] = useState('setup');
    const [selectedTable, setSelectedTable] = useState(null);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [selectedLinkedField, setSelectedLinkedField] = useState(null);
    const [csvData, setCsvData] = useState(null);
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [csvRows, setCsvRows] = useState([]);
    const [csvError, setCsvError] = useState('');
    const [matches, setMatches] = useState(null);
    const fileInputRef = useRef(null);

    // Get records for the selected table
    const tableQuery = selectedTable ? selectedTable.selectRecords() : null;
    useLoadable(tableQuery);
    const records = useRecords(tableQuery);

    const steps = {
        setup: 'Setup & Upload',
        review: 'Configure & Review',
        complete: 'Complete'
    };

    // Reset everything when component mounts
    useEffect(() => {
        setSelectedTable(null);
        setSelectedRecord(null);
        setSelectedLinkedField(null);
        setCsvData(null);
        setCsvHeaders([]);
        setCsvRows([]);
        setCsvError('');
        setMatches(null);
    }, []);

    // CSV parsing functions
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
            
            setCsvHeaders(parsedHeaders);
            setCsvRows(parsedRows);
            setCsvData(parsedRows);
            setCsvError('');
            setMatches(null);
            
        } catch (err) {
            console.error('CSV parsing error:', err);
            setCsvError(`Error parsing CSV: ${err.message}`);
            setCsvHeaders([]);
            setCsvRows([]);
            setCsvData(null);
            setMatches(null);
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.name.endsWith('.csv')) {
            setCsvError('Please select a CSV file');
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

    const clearCsvData = () => {
        setCsvData(null);
        setCsvHeaders([]);
        setCsvRows([]);
        setMatches(null);
        setCsvError('');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRecordPicker = async () => {
        if (!records || records.length === 0) {
            alert('No records found in this table');
            return;
        }

        try {
            const pickedRecord = await expandRecordPickerAsync(records);
            if (pickedRecord) {
                setSelectedRecord(pickedRecord);
                // Reset linked field when record changes
                setSelectedLinkedField(null);
            }
        } catch (error) {
            alert(`Error picking record: ${error.message}`);
        }
    };

    const handleSetupNext = () => {
        if (selectedTable && selectedRecord && selectedLinkedField && csvData) {
            setCurrentStep('review');
        }
    };

    const handleMatchReviewComplete = () => {
        setCurrentStep('complete');
    };

    const canProceedFromSetup = () => {
        return selectedTable && selectedRecord && selectedLinkedField && csvData && csvData.length > 0;
    };

    const renderSetupStep = () => (
        <Box padding={4}>
            <Heading size="large" marginBottom={3}>
                Setup & Upload CSV Data
            </Heading>
            
            <Text marginBottom={4}>
                Select your table, record, and linked field, then upload your CSV data.
            </Text>

            {/* Table/Record/Field Selection */}
            <Box marginBottom={4}>
                <FormField label="Select Table" marginBottom={3}>
                    <TablePicker
                        table={selectedTable}
                        onChange={table => {
                            setSelectedTable(table);
                            setSelectedRecord(null);
                            setSelectedLinkedField(null);
                        }}
                        placeholder="Choose a table..."
                    />
                </FormField>

                {selectedTable && (
                    <FormField label="Select Record" marginBottom={3}>
                        <Box display="flex" alignItems="center">
                            <Button 
                                onClick={handleRecordPicker}
                                disabled={!records || records.length === 0}
                                marginRight={2}
                            >
                                {selectedRecord ? 'Change Record' : 'Pick Record'}
                            </Button>
                            {selectedRecord && (
                                <Text>
                                    Selected: <strong>{selectedRecord.name || selectedRecord.getCellValueAsString(selectedTable.primaryField)}</strong>
                                </Text>
                            )}
                        </Box>
                        {!records && (
                            <Text fontSize="small" textColor="light" marginTop={1}>
                                Loading records...
                            </Text>
                        )}
                        {records && records.length === 0 && (
                            <Text fontSize="small" textColor="light" marginTop={1}>
                                No records found in this table
                            </Text>
                        )}
                        {records && records.length > 0 && !selectedRecord && (
                            <Text fontSize="small" textColor="light" marginTop={1}>
                                Click "Pick Record" to choose from {records.length} records
                            </Text>
                        )}
                    </FormField>
                )}

                {selectedRecord && (
                    <FormField label="Select Linked Record Field" marginBottom={3}>
                        <FieldPicker
                            table={selectedTable}
                            field={selectedLinkedField}
                            onChange={field => setSelectedLinkedField(field)}
                            allowedTypes={['multipleRecordLinks']}
                            placeholder="Choose a linked record field..."
                        />
                    </FormField>
                )}
            </Box>

            {/* CSV Upload Section */}
            {selectedTable && selectedRecord && selectedLinkedField && (
                <Box marginBottom={4}>
                    <Heading size="medium" marginBottom={3}>
                        Upload CSV Data
                    </Heading>
                    
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

                    {csvError && (
                        <Box 
                            padding={3} 
                            backgroundColor="red" 
                            color="white" 
                            borderRadius="4px"
                            marginBottom={3}
                        >
                            <Text>{csvError}</Text>
                        </Box>
                    )}

                    {csvData && csvHeaders.length > 0 && (
                        <Box marginBottom={4}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={3}>
                                <Heading size="medium">
                                    CSV Preview ({csvRows.length} total rows found)
                                </Heading>
                                <Button size="small" onClick={clearCsvData}>
                                    Clear Data
                                </Button>
                            </Box>
                            
                            <Box maxHeight="200px" overflow="auto" border="thick" borderRadius="4px" marginBottom={4}>
                                <Box backgroundColor="white">
                                    <Box display="flex" fontWeight="strong" padding={2} borderBottom="thin">
                                        {csvHeaders.map((header, index) => (
                                            <Box key={index} flex="1" paddingRight={2} minWidth="100px">
                                                {header}
                                            </Box>
                                        ))}
                                    </Box>
                                    {csvRows.slice(0, 5).map((row, rowIndex) => (
                                        <Box key={rowIndex} display="flex" padding={2} borderBottom="thin">
                                            {csvHeaders.map((header, cellIndex) => (
                                                <Box key={cellIndex} flex="1" paddingRight={2} minWidth="100px">
                                                    {row[header] || ''}
                                                </Box>
                                            ))}
                                        </Box>
                                    ))}
                                    {csvRows.length > 5 && (
                                        <Box padding={2} fontStyle="italic" textColor="light">
                                            ... and {csvRows.length - 5} more rows
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    )}
                </Box>
            )}

            {/* Setup Complete Summary */}
            {canProceedFromSetup() && (
                <Box marginTop={4} padding={3} backgroundColor="lightGray1" borderRadius="4px">
                    <Text marginBottom={2}><strong>✅ Setup Complete:</strong></Text>
                    <Text>• Table: <strong>{selectedTable.name}</strong></Text>
                    <Text>• Record: <strong>{selectedRecord.name || selectedRecord.getCellValueAsString(selectedTable.primaryField)}</strong></Text>
                    <Text>• Linked Field: <strong>{selectedLinkedField.name}</strong></Text>
                    <Text>• Target Table: <strong>{base.getTableByIdIfExists(selectedLinkedField.options.linkedTableId)?.name || 'Unknown'}</strong></Text>
                    <Text>• CSV Data: <strong>{csvData.length} rows loaded</strong></Text>
                    
                    <Button
                        variant="primary"
                        marginTop={3}
                        size="large"
                        onClick={handleSetupNext}
                    >
                        🚀 Next: Configure Matching
                    </Button>
                </Box>
            )}

            {/* Progressive guidance */}
            {!selectedTable && (
                <Box marginTop={3} padding={3} backgroundColor="lightGray2" borderRadius="4px">
                    <Text>👆 Start by selecting a table from the dropdown above</Text>
                </Box>
            )}

            {selectedTable && !selectedRecord && records && records.length > 0 && (
                <Box marginTop={3} padding={3} backgroundColor="lightGray2" borderRadius="4px">
                    <Text>📋 Next: Click "Pick Record" to choose a record from <strong>{selectedTable.name}</strong></Text>
                </Box>
            )}

            {selectedRecord && !selectedLinkedField && (
                <Box marginTop={3} padding={3} backgroundColor="lightGray2" borderRadius="4px">
                    <Text>🔗 Next: Select a linked record field to connect CSV data to</Text>
                </Box>
            )}

            {selectedTable && selectedRecord && selectedLinkedField && !csvData && (
                <Box marginTop={3} padding={3} backgroundColor="lightGray2" borderRadius="4px">
                    <Text>📄 Next: Upload your CSV data using one of the options above</Text>
                </Box>
            )}
        </Box>
    );

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 'setup':
                return renderSetupStep();
                
            case 'review':
                return (
                    <MatchReview
                        csvData={csvData}
                        csvHeaders={csvHeaders}
                        linkedTable={base.getTableByIdIfExists(selectedLinkedField?.options?.linkedTableId)}
                        originalRecord={selectedRecord}
                        selectedLinkedField={selectedLinkedField}
                        onComplete={handleMatchReviewComplete}
                        onBack={() => setCurrentStep('setup')}
                        base={base}
                    />
                );
                
            case 'complete':
                return (
                    <Box padding={4}>
                        <Heading size="large" marginBottom={3}>
                            Process Complete! 🎉
                        </Heading>
                        <Text marginBottom={3}>
                            Records have been successfully processed and linked!
                        </Text>
                        <Button 
                            variant="primary"
                            marginTop={3}
                            onClick={() => {
                                setCurrentStep('setup');
                                setSelectedTable(null);
                                setSelectedRecord(null);
                                setSelectedLinkedField(null);
                                setCsvData(null);
                                setCsvHeaders([]);
                                setCsvRows([]);
                                setCsvError('');
                                setMatches(null);
                            }}
                        >
                            Start Over
                        </Button>
                    </Box>
                );

            default:
                return null;
        }
    };

    return (
        <Box>
            {/* Progress indicator */}
            <Box padding={3} borderBottom="thick" backgroundColor="lightGray1">
                <Box display="flex" alignItems="center">
                    {Object.entries(steps).map(([stepKey, stepName], index) => (
                        <Box key={stepKey} display="flex" alignItems="center">
                            <Box
                                padding={2}
                                borderRadius="50%"
                                backgroundColor={currentStep === stepKey ? 'blue' : 'gray'}
                                color="white"
                                minWidth="32px"
                                textAlign="center"
                            >
                                {index + 1}
                            </Box>
                            <Text 
                                marginLeft={2} 
                                fontWeight={currentStep === stepKey ? 'strong' : 'default'}
                            >
                                {stepName}
                            </Text>
                            {index < Object.entries(steps).length - 1 && (
                                <Text marginX={2}>→</Text>
                            )}
                        </Box>
                    ))}
                </Box>
            </Box>

            {renderCurrentStep()}
        </Box>
    );
}

initializeBlock(() => <LinkRecordsApp />);