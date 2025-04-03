import { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Alert, Spinner, ListGroup } from 'react-bootstrap';
import { io } from 'socket.io-client';
import axios from 'axios';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs';
function App() {
    // State
    const [apiKey, setApiKey] = useState('');
    const [description, setDescription] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [socket, setSocket] = useState(null);
    const [generationOutput, setGenerationOutput] = useState('');
    const [generatedFiles, setGeneratedFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [showQuestions, setShowQuestions] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [planComplete, setPlanComplete] = useState(false); // Used to track if planning phase is complete
    const [generationComplete, setGenerationComplete] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [previewUrl, setPreviewUrl] = useState(''); // Stores the URL for previewing the generated app
    // Connect to socket.io server
    useEffect(() => {
        const newSocket = io();
        setSocket(newSocket);
        return () => {
            newSocket.disconnect();
        };
    }, []);
    // Listen for socket events
    useEffect(() => {
        if (!socket)
            return;
        socket.on('generation-progress', (data) => {
            if (data.type === 'data' || data.type === 'plan-data') {
                setGenerationOutput(prev => prev + data.data);
            }
            else if (data.type === 'status') {
                setGenerationOutput(prev => prev + '\n' + data.data + '\n');
            }
            else if (data.type === 'plan-complete') {
                setPlanComplete(true);
                // Extract questions from the initial analysis
                const analysisText = data.data.initialAnalysis;
                const questionsSection = analysisText.split('关键问题:')[1];
                if (questionsSection) {
                    const questionRegex = /\d+\.\s*(.*?)(?=\d+\.|$)/g;
                    const matches = Array.from(questionsSection.matchAll(questionRegex));
                    const extractedQuestions = matches.map((match, index) => {
                        // Type assertion for RegExpMatchArray
                        const matchArray = match;
                        return {
                            id: `question_${index + 1}`,
                            text: matchArray[1] ? matchArray[1].trim() : `Question ${index + 1}`
                        };
                    });
                    setQuestions(extractedQuestions);
                    setShowQuestions(extractedQuestions.length > 0);
                }
            }
            else if (data.type === 'generation-complete') {
                setGenerationComplete(true);
                setGeneratedFiles(data.data.files);
                if (data.data.files.length > 0) {
                    setSelectedFile(data.data.files[0]);
                }
            }
            else if (data.type === 'error') {
                setError(data.data);
                setIsGenerating(false);
            }
        });
        return () => {
            socket.off('generation-progress');
        };
    }, [socket]);
    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!apiKey.trim()) {
            setError('API key is required');
            return;
        }
        if (!description.trim()) {
            setError('Description is required');
            return;
        }
        setError(null);
        setIsGenerating(true);
        setGenerationOutput('');
        setGeneratedFiles([]);
        setSelectedFile(null);
        setPlanComplete(false);
        setGenerationComplete(false);
        setShowQuestions(false);
        setQuestions([]);
        setAnswers({});
        setPreviewUrl('');
        try {
            await axios.post('/api/create', {
                apiKey,
                description
            });
        }
        catch (err) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.error || 'An error occurred');
            }
            else {
                setError('An unexpected error occurred');
            }
            setIsGenerating(false);
        }
    };
    // Handle question answers submission
    const handleAnswersSubmit = async (e) => {
        e.preventDefault();
        setShowQuestions(false);
        // Continue with generation
        setGenerationOutput(prev => prev + '\n\nContinuing with generation...\n');
    };
    // Handle preview button click
    const handlePreview = async () => {
        try {
            const response = await axios.get('/api/preview');
            setPreviewUrl(response.data.previewUrl);
            window.open(response.data.previewUrl, '_blank');
        }
        catch (err) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.error || 'Failed to start preview');
            }
            else {
                setError('An unexpected error occurred');
            }
        }
    };
    // Get file language for syntax highlighting
    const getFileLanguage = (fileName) => {
        if (fileName.endsWith('.html'))
            return 'html';
        if (fileName.endsWith('.css'))
            return 'css';
        if (fileName.endsWith('.js'))
            return 'javascript';
        return 'text';
    };
    return (<Container fluid>
      <Row className="mb-4">
        <Col>
          <h1 className="text-center">WebGen - WebApp Generator</h1>
          <p className="text-center">Generate complete web applications from natural language descriptions</p>
        </Col>
      </Row>

      {error && (<Row className="mb-3">
          <Col>
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          </Col>
        </Row>)}

      <Row>
        <Col md={6}>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>OpenRouter API Key</Form.Label>
              <Form.Control type="password" placeholder="Enter your OpenRouter API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} disabled={isGenerating}/>
              <Form.Text className="text-muted">
                Your API key is used to access the Claude 3.7 model via OpenRouter
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>WebApp Description</Form.Label>
              <Form.Control as="textarea" rows={3} placeholder="Describe the web application you want to generate" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isGenerating}/>
            </Form.Group>

            <Button variant="primary" type="submit" disabled={isGenerating || !apiKey.trim() || !description.trim()}>
              {isGenerating ? (<>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2"/>
                  Generating...
                </>) : 'Generate WebApp'}
            </Button>
          </Form>

          {showQuestions && (<div className="question-form">
              <h4>Please answer these questions to refine your requirements:</h4>
              <Form onSubmit={handleAnswersSubmit}>
                {questions.map((question) => (<Form.Group key={question.id} className="mb-3">
                    <Form.Label>{question.text}</Form.Label>
                    <Form.Control type="text" value={answers[question.id] || ''} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}/>
                  </Form.Group>))}
                <Button variant="primary" type="submit">
                  Submit Answers
                </Button>
              </Form>
            </div>)}

          {generationOutput && (<div className="generation-output mt-4">
              {generationOutput}
            </div>)}
        </Col>

        <Col md={6}>
          {generationComplete && generatedFiles.length > 0 && (<>
              <h4>Generated Files</h4>
              <Row>
                <Col md={4}>
                  <ListGroup className="file-list">
                    {generatedFiles.map((file) => (<ListGroup.Item key={file.name} action active={selectedFile?.name === file.name} onClick={() => setSelectedFile(file)} className="file-item">
                        {file.name}
                      </ListGroup.Item>))}
                  </ListGroup>
                  
                  <Button variant="success" className="mt-3 preview-button" onClick={handlePreview}>
                    Preview WebApp
                  </Button>
                </Col>
                <Col md={8}>
                  {selectedFile && (<div className="code-block">
                      <h5>{selectedFile.name}</h5>
                      <SyntaxHighlighter language={getFileLanguage(selectedFile.name)} style={docco}>
                        {selectedFile.content}
                      </SyntaxHighlighter>
                    </div>)}
                </Col>
              </Row>
            </>)}
        </Col>
      </Row>
    </Container>);
}
export default App;
//# sourceMappingURL=App.js.map