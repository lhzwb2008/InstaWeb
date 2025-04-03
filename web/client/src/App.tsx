import { useState, useEffect } from 'react'
import { Container, Row, Col, Form, Button, Alert, Spinner, ListGroup, Card } from 'react-bootstrap'
import { io, Socket } from 'socket.io-client'
import axios from 'axios'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs'

interface GeneratedFile {
  name: string;
  content: string;
  path: string;
}

interface Question {
  id: string;
  text: string;
}

interface Feedback {
  text: string;
  file?: string;
  submitted: boolean;
  response?: string;
  updatedFiles?: GeneratedFile[];
}

function App() {
  // Hardcoded API key - replace with your actual OpenRouter API key
  const API_KEY = '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' // Replace with your actual API key
  
  // State
  const [description, setDescription] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [generationOutput, setGenerationOutput] = useState('')
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showQuestions, setShowQuestions] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, setPlanComplete] = useState(false) // Used to track if planning phase is complete
  const [generationComplete, setGenerationComplete] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, setPreviewUrl] = useState('') // Stores the URL for previewing the generated app
  
  // Feedback state
  const [feedbackText, setFeedbackText] = useState('')
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    success: boolean;
    message: string;
    screenshot?: string;
    logs?: string[];
  } | null>(null)

  // Connect to socket.io server
  useEffect(() => {
    try {
      // Only attempt to connect to socket.io if we're in generation mode
      if (isGenerating) {
        const newSocket = io({
          reconnectionAttempts: 3,
          timeout: 5000,
          reconnectionDelay: 1000
        })
        
        newSocket.on('connect_error', (err) => {
          console.error('Socket.io connection error:', err);
          setError('Failed to connect to server. Real-time updates may not work.');
        });
        
        setSocket(newSocket)
        
        return () => {
          newSocket.disconnect()
        }
      }
    } catch (err) {
      console.error('Socket.io initialization error:', err);
      setError('Failed to initialize real-time updates. Generation will still work.');
    }
  }, [isGenerating])

  // Listen for socket events
  useEffect(() => {
    if (!socket) return

    socket.on('generation-progress', (data) => {
      if (data.type === 'data' || data.type === 'plan-data') {
        setGenerationOutput(prev => prev + data.data)
      } else if (data.type === 'status') {
        setGenerationOutput(prev => prev + '\n' + data.data + '\n')
      } else if (data.type === 'plan-complete') {
        setPlanComplete(true)
        
        // Extract questions from the initial analysis
        const analysisText = data.data.initialAnalysis
        const questionsSection = analysisText.split('关键问题:')[1]
        
        if (questionsSection) {
          const questionRegex = /\d+\.\s*(.*?)(?=\d+\.|$)/g
          const matches = Array.from(questionsSection.matchAll(questionRegex))
          
          const extractedQuestions = matches.map((match, index) => {
            // Type assertion for RegExpMatchArray
            const matchArray = match as RegExpMatchArray
            return {
              id: `question_${index + 1}`,
              text: matchArray[1] ? matchArray[1].trim() : `Question ${index + 1}`
            }
          })
          
          setQuestions(extractedQuestions)
          setShowQuestions(extractedQuestions.length > 0)
        }
      } else if (data.type === 'generation-complete') {
        setGenerationComplete(true)
        setGeneratedFiles(data.data.files)
        if (data.data.files.length > 0) {
          setSelectedFile(data.data.files[0])
        }
      } else if (data.type === 'error') {
        setError(data.data)
        setIsGenerating(false)
      }
    })
    
    // Listen for validation events
    socket.on('validation-progress', (data) => {
      if (data.type === 'status') {
        setGenerationOutput(prev => prev + '\n' + data.data + '\n')
      } else if (data.type === 'validation-complete') {
        setIsValidating(false)
        setValidationResult(data.data)
      }
    })
    
    // Listen for feedback events
    socket.on('feedback-progress', (data) => {
      if (data.type === 'data') {
        // Update the feedback response in real-time
        setFeedback(prev => ({
          ...(prev || { text: feedbackText, submitted: true }),
          response: (prev?.response || '') + data.data
        }))
      } else if (data.type === 'status') {
        setGenerationOutput(prev => prev + '\n' + data.data + '\n')
      } else if (data.type === 'feedback-complete') {
        setIsSubmittingFeedback(false)
        setFeedback({
          text: feedbackText,
          submitted: true,
          response: data.data.response,
          updatedFiles: data.data.updatedFiles
        })
      } else if (data.type === 'error') {
        setError(data.data)
        setIsSubmittingFeedback(false)
      }
    })

    return () => {
      socket.off('generation-progress')
      socket.off('validation-progress')
      socket.off('feedback-progress')
    }
  }, [socket, feedbackText])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!description.trim()) {
      setError('Description is required')
      return
    }
    
    setError(null)
    setIsGenerating(true)
    setGenerationOutput('')
    setGeneratedFiles([])
    setSelectedFile(null)
    setPlanComplete(false)
    setGenerationComplete(false)
    setShowQuestions(false)
    setQuestions([])
    setAnswers({})
    setPreviewUrl('')
    
    try {
      await axios.post('/api/create', {
        apiKey: API_KEY,
        description
      })
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'An error occurred')
      } else {
        setError('An unexpected error occurred')
      }
      setIsGenerating(false)
    }
  }

  // Handle question answers submission
  const handleAnswersSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setShowQuestions(false)
    
    // Continue with generation
    setGenerationOutput(prev => prev + '\n\nContinuing with generation...\n')
  }

  // Handle preview button click
  const handlePreview = async () => {
    try {
      const response = await axios.get('/api/preview')
      setPreviewUrl(response.data.previewUrl)
      
      // Check if it's a file:// URL
      if (response.data.previewUrl.startsWith('file://')) {
        // For file:// URLs, we need to handle them differently
        // We'll show a message to the user with instructions
        setError(`
          Preview ready! Since we're using a local file, your browser may not open it automatically.
          Please manually open this file in your browser: ${response.data.previewUrl.replace('file://', '')}
        `)
      } else {
        // For http:// URLs, we can open them directly
        window.open(response.data.previewUrl, '_blank')
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to start preview')
      } else {
        setError('An unexpected error occurred')
      }
    }
  }

  // Handle validate button click
  const handleValidate = async () => {
    try {
      setIsValidating(true)
      setValidationResult(null)
      
      const response = await axios.post('/api/validate')
      
      // The validation result will be received through the socket
      // But we can also update the UI based on the response
      if (!response.data.success) {
        setError(response.data.message || 'Validation failed')
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to validate')
      } else {
        setError('An unexpected error occurred')
      }
      setIsValidating(false)
    }
  }

  // Handle feedback submission
  const handleFeedbackSubmit = async () => {
    try {
      setIsSubmittingFeedback(true)
      setFeedback(null)
      
      await axios.post('/api/feedback', {
        apiKey: API_KEY,
        feedback: feedbackText
      })
      
      // The feedback result will be received through the socket
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to submit feedback')
      } else {
        setError('An unexpected error occurred')
      }
      setIsSubmittingFeedback(false)
    }
  }

  // Get file language for syntax highlighting
  const getFileLanguage = (fileName: string) => {
    if (fileName.endsWith('.html')) return 'html'
    if (fileName.endsWith('.css')) return 'css'
    if (fileName.endsWith('.js')) return 'javascript'
    return 'text'
  }

  return (
    <Container fluid>
      <Row className="mb-4">
        <Col>
          <h1 className="text-center">WebGen - WebApp Generator</h1>
          <p className="text-center">Generate complete web applications from natural language descriptions</p>
        </Col>
      </Row>

      {error && (
        <Row className="mb-3">
          <Col>
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          </Col>
        </Row>
      )}

      <Row>
        <Col md={6}>
          <Card className="mb-4">
            <Card.Header>
              <h4 className="m-0">WebApp Description</h4>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Control
                    as="textarea"
                    rows={5}
                    placeholder="Describe the web application you want to generate"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isGenerating}
                  />
                  <Form.Text className="text-muted">
                    Provide a detailed description of the web application you want to create
                  </Form.Text>
                </Form.Group>

                <Button 
                  variant="primary" 
                  type="submit" 
                  disabled={isGenerating || !description.trim()}
                >
                  {isGenerating ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                        className="me-2"
                      />
                      Generating...
                    </>
                  ) : 'Generate WebApp'}
                </Button>
              </Form>
            </Card.Body>
          </Card>

          {showQuestions && (
            <Card className="mb-4">
              <Card.Header>
                <h4 className="m-0">Refine Requirements</h4>
              </Card.Header>
              <Card.Body>
                <Form onSubmit={handleAnswersSubmit}>
                  {questions.map((question) => (
                    <Form.Group key={question.id} className="mb-3">
                      <Form.Label>{question.text}</Form.Label>
                      <Form.Control
                        type="text"
                        value={answers[question.id] || ''}
                        onChange={(e) => setAnswers({...answers, [question.id]: e.target.value})}
                      />
                    </Form.Group>
                  ))}
                  <Button variant="primary" type="submit">
                    Submit Answers
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          )}

          {isGenerating && (
            <Card className="mb-4">
              <Card.Header>
                <div className="d-flex justify-content-between align-items-center">
                  <h4 className="m-0">Generation Progress</h4>
                  <div className="status-indicator">
                    <span className={`status-dot ${isGenerating ? 'active' : ''}`}></span>
                    <span className="status-text">{isGenerating ? 'Generating...' : 'Idle'}</span>
                  </div>
                </div>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="generation-output-container">
                  <pre className="generation-output">
                    {generationOutput || 'Waiting for generation to start...'}
                  </pre>
                </div>
              </Card.Body>
            </Card>
          )}
        </Col>

        <Col md={6}>
          {generationComplete && generatedFiles.length > 0 && (
            <>
              <Card className="mb-4">
                <Card.Header className="bg-primary text-white">
                  <h4 className="m-0">Generated Files</h4>
                </Card.Header>
                <Card.Body className="p-3">
                  <Row>
                    <Col md={4}>
                      <ListGroup className="file-list">
                        {generatedFiles.map((file) => (
                          <ListGroup.Item 
                            key={file.name}
                            action
                            active={selectedFile?.name === file.name}
                            onClick={() => setSelectedFile(file)}
                            className="file-item"
                          >
                            {file.name}
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                      
                      <div className="d-grid gap-2 mt-3">
                        <Button 
                          variant="success" 
                          className="preview-button"
                          onClick={handlePreview}
                        >
                          Preview WebApp
                        </Button>
                        
                        <Button 
                          variant="info" 
                          className="validate-button"
                          onClick={handleValidate}
                          disabled={isValidating}
                        >
                          {isValidating ? (
                            <>
                              <Spinner
                                as="span"
                                animation="border"
                                size="sm"
                                role="status"
                                aria-hidden="true"
                                className="me-2"
                              />
                              Validating...
                            </>
                          ) : 'Validate WebApp'}
                        </Button>
                      </div>
                    </Col>
                    <Col md={8}>
                      {selectedFile && (
                        <div className="code-block">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <h5 className="m-0">{selectedFile.name}</h5>
                            <span className="badge bg-secondary">{getFileLanguage(selectedFile.name)}</span>
                          </div>
                          <div className="code-container">
                            <SyntaxHighlighter 
                              language={getFileLanguage(selectedFile.name)}
                              style={docco}
                              customStyle={{ margin: 0 }}
                              wrapLines={true}
                              showLineNumbers={true}
                            >
                              {selectedFile.content}
                            </SyntaxHighlighter>
                          </div>
                        </div>
                      )}
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
              
              {/* Validation Results */}
              {validationResult && (
                <Card className="mb-4">
                  <Card.Header className={validationResult.success ? 'bg-success text-white' : 'bg-warning text-dark'}>
                    <h4 className="m-0">Validation Results</h4>
                  </Card.Header>
                  <Card.Body>
                    <Alert variant={validationResult.success ? 'success' : 'warning'}>
                      {validationResult.message}
                    </Alert>
                    
                    {validationResult.screenshot && (
                      <div className="screenshot-container mt-3">
                        <h5>Screenshot</h5>
                        <img 
                          src={`data:image/png;base64,${validationResult.screenshot}`} 
                          alt="WebApp Screenshot" 
                          className="img-fluid border"
                        />
                      </div>
                    )}
                    
                    {validationResult.logs && validationResult.logs.length > 0 && (
                      <div className="logs-container mt-3">
                        <h5>Console Logs</h5>
                        <div className="logs-output">
                          {validationResult.logs.map((log, index) => (
                            <div key={index} className="log-entry">
                              {log}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              )}
              
              {/* Feedback Form */}
              <Card className="mb-4">
                <Card.Header className="bg-light">
                  <h4 className="m-0">Provide Feedback</h4>
                </Card.Header>
                <Card.Body>
                  <Form>
                    <Form.Group className="mb-3">
                      <Form.Label>What would you like to improve?</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        placeholder="Describe what you'd like to change or improve..."
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        disabled={isSubmittingFeedback}
                      />
                    </Form.Group>
                    
                    <Button 
                      variant="primary" 
                      onClick={handleFeedbackSubmit}
                      disabled={isSubmittingFeedback || !feedbackText.trim()}
                    >
                      {isSubmittingFeedback ? (
                        <>
                          <Spinner
                            as="span"
                            animation="border"
                            size="sm"
                            role="status"
                            aria-hidden="true"
                            className="me-2"
                          />
                          Submitting...
                        </>
                      ) : 'Submit Feedback'}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
              
              {/* Feedback Response */}
              {feedback && feedback.submitted && (
                <Card className="mb-4">
                  <Card.Header className="bg-info text-white">
                    <h4 className="m-0">AI Response</h4>
                  </Card.Header>
                  <Card.Body>
                    <Alert variant="info">
                      {feedback.response || 'Processing your feedback...'}
                    </Alert>
                    
                    {feedback.updatedFiles && feedback.updatedFiles.length > 0 && (
                      <div className="updated-files mt-3">
                        <h5>Updated Files</h5>
                        <ListGroup>
                          {feedback.updatedFiles.map((file) => (
                            <ListGroup.Item 
                              key={file.name}
                              action
                              onClick={() => {
                                // Update the selected file to show the updated version
                                setSelectedFile(file);
                              }}
                            >
                              {file.name} (Updated)
                            </ListGroup.Item>
                          ))}
                        </ListGroup>
                        
                        <Button 
                          variant="success" 
                          className="mt-3"
                          onClick={() => {
                            // Apply the updates
                            setGeneratedFiles(feedback.updatedFiles || []);
                            setFeedback(null);
                            setFeedbackText('');
                          }}
                        >
                          Apply Updates
                        </Button>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              )}
            </>
          )}
        </Col>
      </Row>
    </Container>
  )
}

export default App
