import React from 'react';
import {
    Box,
    Button,
    Heading,
    Text,
} from '@airtable/blocks/ui';

function MatchResults({ 
    matches, 
    moveRecord, 
    canProcess, 
    hasValidExactMatch 
}) {
    const renderRecordCard = (item, index, category) => {
        const record = item.csvRow || item;
        const airtableRecord = item.airtableRecord;
        
        return (
            <Box key={`${category}-${index}`} padding={3} border="thin" marginBottom={2} borderRadius="4px">
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
                            variant="primary"
                            onClick={() => {
                                console.log(`Confirming match for record ${index}`);
                                moveRecord('fuzzy', 'definite', index);
                            }}
                        >
                            ✅ Confirm Match
                        </Button>
                        <Button
                            size="small"
                            onClick={() => {
                                console.log(`Creating new record for record ${index}`);
                                moveRecord('fuzzy', 'missing', index);
                            }}
                        >
                            ➕ Create New
                        </Button>
                    </Box>
                )}
            </Box>
        );
    };

    return (
        <Box marginBottom={4}>
            <Heading size="medium" marginBottom={3}>
                3. Review & Categorize Matches
            </Heading>

            <Box display="flex" gap={4}>
                {/* Exact Matches Column */}
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

                {/* Fuzzy Matches Column */}
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

                {/* Records to Create Column */}
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
        </Box>
    );
}

export default MatchResults;