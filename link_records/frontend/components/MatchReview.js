import React, { useState } from 'react';
import {
    Box,
    Button,
    Heading,
    Text,
} from '@airtable/blocks/ui';

function MatchReview({ matches, linkedTable, originalRecord, selectedLinkedField, onComplete, onBack }) {
    const [activeTab, setActiveTab] = useState('definite');
    const [processing, setProcessing] = useState(false);

    const tabs = [
        { key: 'definite', label: 'Definite Matches', count: matches?.definite?.length || 0 },
        { key: 'fuzzy', label: 'Fuzzy Matches', count: matches?.fuzzy?.length || 0 },
        { key: 'missing', label: 'Missing Records', count: matches?.missing?.length || 0 }
    ];

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

    const renderContent = () => {
        const currentMatches = matches[activeTab] || [];
        
        if (currentMatches.length === 0) {
            return <Text>No {activeTab} matches found.</Text>;
        }

        return (
            <Box>
                {activeTab === 'definite' && (
                    <Text marginBottom={3}>These records will be automatically linked:</Text>
                )}
                {activeTab === 'fuzzy' && (
                    <Text marginBottom={3}>These records have similar names but different emails. Review needed:</Text>
                )}
                {activeTab === 'missing' && (
                    <Text marginBottom={3}>These records will be created as new entries:</Text>
                )}

                <Box>
                    {currentMatches.slice(0, 10).map((item, index) => (
                        <Box key={index} padding={3} border="thin" marginBottom={2} borderRadius="4px">
                            <Text><strong>Name:</strong> {item.name || item.csvRow?.name || item.csvRow?.Name || 'N/A'}</Text>
                            <Text><strong>Email:</strong> {item.email || item.csvRow?.email || item.csvRow?.Email || 'N/A'}</Text>
                            {activeTab === 'fuzzy' && item.similarity && (
                                <Text><strong>Similarity:</strong> {Math.round(item.similarity * 100)}%</Text>
                            )}
                            {activeTab === 'fuzzy' && (
                                <Box marginTop={2}>
                                    <Text fontSize="small" textColor="light">
                                        CSV: {item.csvRow?.name} ({item.csvRow?.email}) → 
                                        Airtable: {item.airtableRecord?.name} ({item.airtableRecord?.email})
                                    </Text>
                                </Box>
                            )}
                        </Box>
                    ))}
                    {currentMatches.length > 10 && (
                        <Text>... and {currentMatches.length - 10} more</Text>
                    )}
                </Box>
            </Box>
        );
    };

    return (
        <Box padding={4}>
            <Heading size="large" marginBottom={3}>
                Review Matches
            </Heading>

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
                <Text>• {matches.fuzzy?.length || 0} records need review (fuzzy matches)</Text>
                <Text>• {matches.missing?.length || 0} new records will be created</Text>
            </Box>

            {processing && (
                <Box marginBottom={4} padding={3} backgroundColor="blue" color="white" borderRadius="4px">
                    <Text>Processing changes... Please wait.</Text>
                </Box>
            )}

            {/* Navigation */}
            <Box display="flex" justifyContent="space-between">
                <Button onClick={onBack} disabled={processing}>
                    Back
                </Button>
                
                <Button
                    variant="primary"
                    onClick={processAllChanges}
                    disabled={processing}
                >
                    {processing ? 'Processing...' : 'Apply Changes (Basic)'}
                </Button>
            </Box>
        </Box>
    );
}

export default MatchReview;