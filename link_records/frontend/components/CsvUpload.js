import React, { useState, useRef } from 'react';
import {
    Box,
    Button,
    Heading,
    Text,
} from '@airtable/blocks/ui';

function CsvUpload({ onUpload, onBack }) {
    const [csvData, setCsvData] = useState(null);
    const [headers, setHeaders] = useState([]);
    const [rows, setRows] = useState([]);
    const [error, setError] = useState('');
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

    return (
        <Box padding={4}>
            <Heading size="large" marginBottom={3}>
                Upload CSV Data
            </Heading>
            
            <Text marginBottom={3}>
                Upload a CSV file or paste CSV data containing participant information.
                Make sure your CSV includes columns for email, name, and any other relevant fields.
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

            {csvData && (
                <Box marginBottom={4}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={3}>
                        <Heading size="medium">
                            Preview ({rows.length} rows)
                        </Heading>
                        <Button size="small" onClick={clearData}>
                            Clear Data
                        </Button>
                    </Box>
                    
                    <Box maxHeight="300px" overflow="auto" border="thick" borderRadius="4px">
                        <Box backgroundColor="white">
                            <Box display="flex" fontWeight="strong" padding={2} borderBottom="thin">
                                {headers.map((header, index) => (
                                    <Box key={index} flex="1" paddingRight={2}>
                                        {header}
                                    </Box>
                                ))}
                            </Box>
                            {rows.slice(0, 10).map((row, rowIndex) => (
                                <Box key={rowIndex} display="flex" padding={2} borderBottom="thin">
                                    {headers.map((header, cellIndex) => (
                                        <Box key={cellIndex} flex="1" paddingRight={2}>
                                            {row[header] || ''}
                                        </Box>
                                    ))}
                                </Box>
                            ))}
                        </Box>
                        {rows.length > 10 && (
                            <Box padding={2} textAlign="center" backgroundColor="lightGray1">
                                <Text>... and {rows.length - 10} more rows</Text>
                            </Box>
                        )}
                    </Box>
                </Box>
            )}

            <Box display="flex" justifyContent="space-between">
                <Button onClick={onBack}>
                    Back
                </Button>
                
                <Button
                    variant="primary"
                    disabled={!csvData}
                    onClick={() => onUpload(csvData)}
                >
                    Process Matches ({csvData ? csvData.length : 0} rows)
                </Button>
            </Box>
        </Box>
    );
}

export default CsvUpload;