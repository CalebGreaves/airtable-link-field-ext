import React from 'react';
import {
    Box,
    Button,
    Heading,
    Text,
    Select,
} from '@airtable/blocks/ui';

function FieldMapping({ 
    csvHeaders, 
    linkedTable, 
    fieldMappings, 
    updateFieldMapping, 
    removeFieldMapping,
    csvData 
}) {
    // Get field options for dropdowns
    const airtableFieldOptions = [
        { value: '', label: 'Select Airtable field...' },
        ...(linkedTable ? linkedTable.fields.map(field => ({
            value: field.id,
            label: `${field.name} (${field.type})`
        })) : [])
    ];

    return (
        <Box marginBottom={4}>
            <Heading size="medium" marginBottom={3}>
                1. Field Mapping
            </Heading>
            <Text fontSize="small" textColor="light" marginBottom={3}>
                Map your CSV fields to Airtable fields. Only mapped fields will be used for record creation.
            </Text>
            
            <Box padding={3} border="thick" borderRadius="4px" backgroundColor="lightGray1">
                <Box display="flex" gap={4}>
                    {/* Available CSV Fields */}
                    <Box flex="1">
                        <Heading size="small" marginBottom={2}>Available CSV Fields</Heading>
                        <Box maxHeight="300px" overflow="auto">
                            {csvHeaders?.map(csvField => {
                                const currentMapping = fieldMappings.csvToAirtable[csvField];
                                const isMapped = !!currentMapping;
                                
                                return (
                                    <Box 
                                        key={csvField} 
                                        marginBottom={2} 
                                        padding={2} 
                                        backgroundColor={isMapped ? "green" : "white"}
                                        color={isMapped ? "white" : "black"}
                                        borderRadius="4px"
                                        border="thin"
                                    >
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Text fontSize="small" fontWeight="strong">
                                                {csvField}
                                            </Text>
                                            {isMapped && (
                                                <Button
                                                    size="small"
                                                    onClick={() => removeFieldMapping(csvField)}
                                                    backgroundColor="red"
                                                    textColor="white"
                                                    borderRadius="4px"
                                                >
                                                    Remove
                                                </Button>
                                            )}
                                        </Box>
                                        
                                        {isMapped && (
                                            <Text fontSize="small" marginTop={1}>
                                                → {linkedTable?.getFieldByIdIfExists(currentMapping)?.name || 'Unknown Field'}
                                            </Text>
                                        )}
                                        
                                        {!isMapped && (
                                            <Box marginTop={2}>
                                                <Select
                                                    options={[
                                                        { value: '', label: 'Map to Airtable field...' },
                                                        ...airtableFieldOptions.slice(1)
                                                    ]}
                                                    value=""
                                                    onChange={value => {
                                                        if (value) {
                                                            updateFieldMapping(csvField, value);
                                                        }
                                                    }}
                                                    size="small"
                                                    placeholder="Select Airtable field..."
                                                />
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                    
                    {/* Sample Data Preview */}
                    <Box flex="1">
                        <Heading size="small" marginBottom={2}>Sample Data Preview</Heading>
                        <Box maxHeight="300px" overflow="auto" padding={2} backgroundColor="white" borderRadius="4px" border="thin">
                            {csvData?.slice(0, 3).map((row, index) => (
                                <Box key={index} marginBottom={3} padding={2} backgroundColor="lightGray2" borderRadius="4px">
                                    <Text fontSize="small" fontWeight="strong" marginBottom={1}>Row {index + 1}:</Text>
                                    {csvHeaders?.map(header => (
                                        <Box key={header} marginBottom={1}>
                                            <Text fontSize="small">
                                                <strong>{header}:</strong> {row[header] || 'N/A'}
                                            </Text>
                                        </Box>
                                    ))}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                </Box>
                
                {/* Mapping Summary */}
                <Box marginTop={3} padding={2} backgroundColor="blue" color="white" borderRadius="4px">
                    <Text fontSize="small" fontWeight="strong">
                        Mapping Summary: {Object.keys(fieldMappings.csvToAirtable).length} of {csvHeaders?.length || 0} CSV fields mapped
                    </Text>
                    {Object.entries(fieldMappings.csvToAirtable).map(([csvField, airtableFieldId]) => {
                        const airtableField = linkedTable?.getFieldByIdIfExists(airtableFieldId);
                        return (
                            <Text key={csvField} fontSize="small" marginLeft={2}>
                                • {csvField} → {airtableField?.name || 'Unknown'}
                            </Text>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
}

export default FieldMapping;