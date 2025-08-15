import React from 'react';
import {
    Box,
    Button,
    Heading,
    Text,
    FormField,
    Select,
    Switch,
} from '@airtable/blocks/ui';

function MatchingLogic({ 
    fieldMappings, 
    linkedTable,
    updateExactMatchField,
    addExactMatchField,
    removeExactMatchField,
    addExactMatchCombination,
    removeExactMatchCombination,
    updateFuzzyMatchField,
    addFuzzyMatchField,
    removeFuzzyMatchField,
    addFuzzyMatchCombination,
    removeFuzzyMatchCombination,
    setFieldMappings,
    generateId
}) {
    // Get available mapped fields for matching dropdowns
    const getMappedFieldOptions = () => {
        const mappedFields = Object.entries(fieldMappings.csvToAirtable)
            .filter(([csvField, airtableFieldId]) => csvField && airtableFieldId)
            .map(([csvField, airtableFieldId]) => {
                const airtableField = linkedTable?.getFieldByIdIfExists(airtableFieldId);
                return {
                    value: csvField,
                    label: `${csvField} → ${airtableField?.name || 'Unknown'}`
                };
            });
        
        return [
            { value: '', label: 'Select mapped field...' },
            ...mappedFields
        ];
    };

    const matchTypeOptions = [
        { value: 'exact', label: 'Exact' },
        { value: 'fuzzy', label: 'Fuzzy (typos/similar)' },
        { value: 'word', label: 'Word (different order)' },
        { value: 'contains', label: 'Contains' }
    ];

    const removeFieldCombination = (groupId, comboId, isExact) => {
        if (isExact) {
            removeExactMatchCombination(groupId, comboId);
        } else {
            removeFuzzyMatchCombination(groupId, comboId);
        }
    };

    // Simplified field combination renderer
    const renderFieldCombination = (combo, group, comboIndex, isExact = true) => {
        const mappedFieldOptions = getMappedFieldOptions();
        
        return (
            <Box 
                key={combo.id} 
                marginBottom={3} 
                padding={3} 
                border="thin" 
                borderRadius="4px"
                backgroundColor="white"
                position="relative"
                className="field-combination"
            >
                {/* Delete OR condition button */}
                {group.fieldCombinations.length > 1 && (
                    <Button
                        size="small"
                        onClick={() => removeFieldCombination(group.id, combo.id, isExact)}
                        position="absolute"
                        top={2}
                        right={2}
                        backgroundColor="red"
                        textColor="white"
                        borderRadius="50%"
                        width="24px"
                        height="24px"
                        padding={0}
                        style={{ 
                            cursor: 'pointer',
                            fontSize: '12px',
                            lineHeight: '1',
                            opacity: 0.7
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = '1'}
                        onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                    >
                        ×
                    </Button>
                )}
                
                {/* Vertical line for grouping */}
                <Box
                    position="absolute"
                    left="-12px"
                    top="0"
                    bottom="0"
                    width="4px"
                    backgroundColor="blue"
                    borderRadius="2px"
                />
                
                <Text fontSize="small" fontWeight="strong" marginBottom={3}>
                    {comboIndex === 0 ? 'Match if' : 'OR if'} (ALL match):
                </Text>
                
                {combo.fields.map((field, fieldIndex) => (
                    <Box 
                        key={fieldIndex} 
                        marginBottom={2} 
                        padding={3}
                        backgroundColor="lightGray1"
                        borderRadius="4px"
                        position="relative"
                        className="field-card"
                        style={{ transition: 'box-shadow 0.2s' }}
                    >
                        {/* Delete field button */}
                        {combo.fields.length > 1 && (
                            <Button
                                size="small"
                                onClick={() => {
                                    if (isExact) {
                                        removeExactMatchField(group.id, combo.id, fieldIndex);
                                    } else {
                                        removeFuzzyMatchField(group.id, combo.id, fieldIndex);
                                    }
                                }}
                                position="absolute"
                                top={2}
                                right={2}
                                backgroundColor="red"
                                textColor="white"
                                borderRadius="50%"
                                width="20px"
                                height="20px"
                                padding={0}
                                style={{ 
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    lineHeight: '1',
                                    opacity: 0.7
                                }}
                                onMouseEnter={(e) => e.target.style.opacity = '1'}
                                onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                            >
                                ×
                            </Button>
                        )}
                        
                        <Box display="flex" gap={2}>
                            <Box flex="2">
                                <FormField label="Mapped Field" marginBottom={1}>
                                    <Select
                                        options={mappedFieldOptions}
                                        value={field.mappedField || ''}
                                        onChange={value => {
                                            if (isExact) {
                                                updateExactMatchField(group.id, combo.id, fieldIndex, 'mappedField', value);
                                            } else {
                                                updateFuzzyMatchField(group.id, combo.id, fieldIndex, 'mappedField', value);
                                            }
                                        }}
                                        size="small"
                                    />
                                </FormField>
                            </Box>
                            <Box flex="1">
                                <FormField label="Match Type" marginBottom={1}>
                                    <Select
                                        options={matchTypeOptions}
                                        value={field.matchType}
                                        onChange={value => {
                                            if (isExact) {
                                                updateExactMatchField(group.id, combo.id, fieldIndex, 'matchType', value);
                                            } else {
                                                updateFuzzyMatchField(group.id, combo.id, fieldIndex, 'matchType', value);
                                            }
                                        }}
                                        size="small"
                                    />
                                </FormField>
                            </Box>
                        </Box>
                    </Box>
                ))}
                
                <Button 
                    size="small" 
                    onClick={() => {
                        if (isExact) {
                            addExactMatchField(group.id, combo.id);
                        } else {
                            addFuzzyMatchField(group.id, combo.id);
                        }
                    }}
                    marginTop={2}
                >
                    + Add Field
                </Button>
            </Box>
        );
    };

    return (
        <Box marginBottom={4}>
            <Heading size="medium" marginBottom={3}>
                2. Matching Logic
            </Heading>
            <Text fontSize="small" textColor="light" marginBottom={3}>
                Configure which mapped fields to use for finding matches. Only mapped fields are available.
            </Text>
            
            <Box display="flex" gap={4}>
                {/* Exact Match Logic */}
                <Box flex="1">
                    <Box padding={3} border="thick" borderRadius="4px" height="100%" position="relative">
                        <Heading size="small" marginBottom={3}>
                            Exact Match Logic
                        </Heading>
                        <Text fontSize="small" textColor="light" marginBottom={3}>
                            Configure which mapped fields must match exactly.
                        </Text>
                        
                        {fieldMappings.exactMatchGroups.map((group, groupIndex) => (
                            <Box key={group.id} marginBottom={3} marginLeft={3} position="relative">
                                {group.fieldCombinations.map((combo, comboIndex) => 
                                    renderFieldCombination(combo, group, comboIndex, true)
                                )}
                                <Button 
                                    size="small" 
                                    onClick={() => addExactMatchCombination(group.id)}
                                    marginTop={2}
                                    marginLeft={3}
                                >
                                    + Add OR Condition
                                </Button>
                            </Box>
                        ))}
                    </Box>
                </Box>

                {/* Fuzzy Match Logic */}
                <Box flex="1">
                    {fieldMappings.enableFuzzyMatching && (
                        <Box padding={3} border="thick" borderRadius="4px" height="100%" position="relative">
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
                                Configure which mapped fields to use for similarity matching.
                            </Text>
                            
                            {fieldMappings.fuzzyMatchGroups.map((group, groupIndex) => (
                                <Box key={group.id} marginBottom={3} marginLeft={3} position="relative">
                                    {group.fieldCombinations.map((combo, comboIndex) => 
                                        renderFieldCombination(combo, group, comboIndex, false)
                                    )}
                                    <Button 
                                        size="small" 
                                        onClick={() => addFuzzyMatchCombination(group.id)}
                                        marginTop={2}
                                        marginLeft={3}
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
            </Box>
        </Box>
    );
}

export default MatchingLogic;