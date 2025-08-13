import React, { useState } from 'react';
import {
    Box,
    Button,
    Heading,
    Text,
    Select,
} from '@airtable/blocks/ui';

function MatchReview({ matches: initialMatches, linkedTable, originalRecord, selectedLinkedField, onComplete, onBack }) {
    const [matches, setMatches] = useState(initialMatches);
    const [activeTab, setActiveTab] = useState('fuzzy');
    const [processing, setProcessing] = useState(false);

    const tabs = [
        { key: 'definite', label: 'Definite Matches', count: matches?.definite?.length || 0 },
        { key: 'fuzzy', label: 'Fuzzy Matches', count: matches?.fuzzy?.length || 0 },
        { key: 'missing', label: 'Missing Records', count: matches?.missing?.length || 0 }
    ];

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
        return matches?.fuzzy?.length === 0; // All fuzzy matches must be resolved
    };

    const renderRecordCard = (item, index, category) => {
        const record = item.csvRow || item;
        const airtableRecord = item.airtableRecord;
        
        return (
            <Box key={index} padding={3} border="thin" marginBottom={2} borderRadius="4px">
                <Box display="flex" justifyContent="space-between" alignItems="start" marginBottom={2}>
                    <Box flex="1">
                        <Text><strong>Name:</strong> {record.name || record.Name || 'N/A'}</Text>
                        <Text><strong>Email:</strong> {record.email || record.Email || 'N/A'}</Text>
                        {record['Health Center'] && (
                            <Text><strong>Health Center:</strong> {record['Health Center']}</Text>
                        )}
                        {category === 'fuzzy' && item.similarity && (
                            <Text><strong>Similarity:</strong> {Math.round(item.similarity * 100)}%</Text>
                        )}
                        {category === 'fuzzy' && airtableRecord && (
                            <Box marginTop={2} padding={2} backgroundColor="lightGray2" borderRadius="4px">
                                <Text fontSize="small" fontWeight="strong">Matched Airtable Record:</Text>
                                <Text fontSize="small">Name: {airtableRecord.name}</Text>
                                <Text fontSize="small">
                                    Other fields: {JSON.stringify(airtableRecord).slice(0, 100)}...
                                </Text>
                            </Box>
                        )}
                    </Box>
                    
                    {/* Action buttons for moving records */}
                    <Box marginLeft={3}>
                        {category === 'fuzzy' && (
                            <Box>
                                <Button
                                    size="small"
                                    marginBottom={1}
                                    onClick={() => moveRecord('fuzzy', 'definite', index)}
                                >
                                    → Definite
                                </Button>
                                <Button
                                    size="small"
                                    onClick={() => moveRecord('fuzzy', 'missing', index)}
                                >
                                    → Missing
                                </Button>
                            </Box>
                        )}
                        
                        {category === 'definite' && (
                            <Box>
                                <Button
                                    size="small"
                                    marginBottom={1}
                                    onClick={() => moveRecord('definite', 'fuzzy', index)}
                                >
                                    → Fuzzy
                                </Button>
                                <Button
                                    size="small"
                                    onClick={() => moveRecord('definite', 'missing', index)}
                                >
                                    → Missing
                                </Button>
                            </Box>
                        )}
                        
                        {category === 'missing' && (
                            <Box>
                                <Button
                                    size="small"
                                    marginBottom={1}
                                    onClick={() => moveRecord('missing', 'definite', index)}
                                >
                                    → Definite
                                </Button>
                                <Button
                                    size="small"
                                    onClick={() => moveRecord('missing', 'fuzzy', index)}
                                >
                                    → Fuzzy
                                </Button>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>
        );
    };

    const renderContent = () => {
        const currentMatches = matches[activeTab] || [];
        
        if (currentMatches.length === 0) {
            return (
                <Box padding={4} textAlign="center">
                    <Text fontSize="large">✅ No {activeTab} matches!</Text>
                    {activeTab === 'fuzzy' && (
                        <Text marginTop={2} fontSize="small" textColor="light">
                            All records have been categorized as either definite matches or missing records.
                        </Text>
                    )}
                </Box>
            );
        }

        return (
            <Box>
                {activeTab === 'definite' && (
                    <Text marginBottom={3} backgroundColor="green" color="white" padding={2} borderRadius="4px">
                        ✅ These records will be automatically linked to existing Airtable records:
                    </Text>
                )}
                {activeTab === 'fuzzy' && (
                    <Text marginBottom={3} backgroundColor="orange" color="white" padding={2} borderRadius="4px">
                        ⚠️ These records need your review. Move them to "Definite" or "Missing":
                    </Text>
                )}
                {activeTab === 'missing' && (
                    <Text marginBottom={3} backgroundColor="blue" color="white" padding={2} borderRadius="4px">
                        ➕ These records will be created as new entries in Airtable:
                    </Text>
                )}

                <Box maxHeight="400px" overflow="auto">
                    {currentMatches.map((item, index) => renderRecordCard(item, index, activeTab))}
                </Box>
            </Box>
        );
    };

    return (
        <Box padding={4}>
            <Heading size="large" marginBottom={3}>
                Review & Categorize Matches
            </Heading>

            <Text marginBottom={3}>
                Review the automatically categorized matches and move records between categories as needed.
                You must resolve all fuzzy matches before proceeding.
            </Text>

            {/* Tab Navigation */}
            <Box display="flex" marginBottom={4}>
                {tabs.map(tab => (
                    <Button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        variant={activeTab === tab.key ? 'primary' : 'default'}
                        marginRight={2}
                        size="small"
                    >
                        {tab.label} ({tab.count})
                    </Button>
                ))}
            </Box>

            {/* Tab Content */}
            <Box marginBottom={4}>
                {renderContent()}
            </Box>

            {/* Summary */}
            <Box padding={3} backgroundColor="lightGray1" borderRadius="4px" marginBottom={4}>
                <Heading size="small" marginBottom={2}>Summary</Heading>
                <Text>• {matches.definite?.length || 0} records will be linked (definite matches)</Text>
                <Text>• {matches.fuzzy?.length || 0} records still need review (fuzzy matches)</Text>
                <Text>• {matches.missing?.length || 0} new records will be created</Text>
                
                {!canProcess() && (
                    <Box marginTop={2} padding={2} backgroundColor="orange" color="white" borderRadius="4px">
                        <Text fontSize="small">
                            ⚠️ You must resolve all fuzzy matches before proceeding. 
                            Move them to either "Definite" or "Missing" categories.
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
                <Box marginBottom={4} padding={3} backgroundColor="blue" color="white" borderRadius="4px">
                    <Text>Processing changes... Please wait.</Text>
                </Box>
            )}

            {/* Navigation */}
            <Box display="flex" justifyContent="space-between">
                <Button onClick={onBack} disabled={processing}>
                    Back to Configuration
                </Button>
                
                <Button
                    variant="primary"
                    onClick={processAllChanges}
                    disabled={processing || !canProcess()}
                >
                    {processing ? 'Processing...' : `Apply Changes (${matches.definite?.length || 0} links, ${matches.missing?.length || 0} new)`}
                </Button>
            </Box>
        </Box>
    );
}

export default MatchReview;