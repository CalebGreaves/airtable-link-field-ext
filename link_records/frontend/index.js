import {initializeBlock, expandRecordPickerAsync} from '@airtable/blocks/ui';
import React, {useState} from 'react';
import {
    Box,
    Button,
    FormField,
    Heading,
    TablePickerSynced,
    FieldPickerSynced,
    Text,
    useBase,
    useRecords,
    useLoadable,
} from '@airtable/blocks/ui';
import './style.css';

// Import our custom components
import CsvUpload from './components/CsvUpload';
import MatchReview from './components/MatchReview';
import { processMatches } from './utils/matching';

function LinkRecordsApp() {
    const base = useBase();
    const [currentStep, setCurrentStep] = useState('setup');
    const [selectedTable, setSelectedTable] = useState(null);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [selectedLinkedField, setSelectedLinkedField] = useState(null);
    const [csvData, setCsvData] = useState(null);
    const [matches, setMatches] = useState(null);

    // Get records for the selected table
    const tableQuery = selectedTable ? selectedTable.selectRecords() : null;
    useLoadable(tableQuery);
    const records = useRecords(tableQuery);

    const steps = {
        setup: 'Setup',
        upload: 'Upload CSV',
        review: 'Review Matches',
        complete: 'Complete'
    };

    const handleSetupNext = () => {
        if (selectedTable && selectedRecord && selectedLinkedField) {
            setCurrentStep('upload');
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

    const handleCsvUpload = (data) => {
        setCsvData(data);
        
        // Process matches using the utility function
        const linkedTable = base.getTableByIdIfExists(selectedLinkedField.options.linkedTableId);
        if (linkedTable) {
            const processedMatches = processMatches(data, linkedTable, base);
            setMatches(processedMatches);
        }
        
        setCurrentStep('review');
    };

    const handleMatchReviewComplete = () => {
        setCurrentStep('complete');
    };

    const renderSetupStep = () => (
        <Box padding={4}>
            <Heading size="large" marginBottom={3}>
                Setup Link Records
            </Heading>
            
            <FormField label="Select Table" marginBottom={3}>
                <TablePickerSynced
                    globalConfigKey="selectedTableId"
                    onChange={table => {
                        setSelectedTable(table);
                        setSelectedRecord(null); // Reset record when table changes
                        setSelectedLinkedField(null); // Reset field when table changes
                    }}
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
                    <FieldPickerSynced
                        table={selectedTable}
                        globalConfigKey="selectedLinkedFieldId"
                        allowedTypes={['multipleRecordLinks']}
                        onChange={field => setSelectedLinkedField(field)}
                    />
                </FormField>
            )}

            {selectedTable && selectedRecord && selectedLinkedField && (
                <Box marginTop={4} padding={3} backgroundColor="lightGray1" borderRadius="4px">
                    <Text marginBottom={2}><strong>✅ Setup Complete:</strong></Text>
                    <Text>• Table: <strong>{selectedTable.name}</strong></Text>
                    <Text>• Record: <strong>{selectedRecord.name || selectedRecord.getCellValueAsString(selectedTable.primaryField)}</strong></Text>
                    <Text>• Linked Field: <strong>{selectedLinkedField.name}</strong></Text>
                    <Text>• Target Table: <strong>{base.getTableByIdIfExists(selectedLinkedField.options.linkedTableId)?.name || 'Unknown'}</strong></Text>
                    
                    <Button
                        variant="primary"
                        marginTop={3}
                        size="large"
                        onClick={handleSetupNext}
                    >
                        🚀 Next: Upload CSV
                    </Button>
                </Box>
            )}

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
        </Box>
    );

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 'setup':
                return renderSetupStep();
                
            case 'upload':
                return (
                    <CsvUpload 
                        onUpload={handleCsvUpload}
                        onBack={() => setCurrentStep('setup')}
                    />
                );
                
            case 'review':
                return (
                    <MatchReview
                        matches={matches}
                        linkedTable={base.getTableByIdIfExists(selectedLinkedField?.options?.linkedTableId)}
                        originalRecord={selectedRecord}
                        selectedLinkedField={selectedLinkedField}
                        onComplete={handleMatchReviewComplete}
                        onBack={() => setCurrentStep('upload')}
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