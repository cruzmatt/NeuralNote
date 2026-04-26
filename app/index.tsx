import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Modal, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import Svg, { Path, Line, Defs, Pattern, Rect, Circle } from 'react-native-svg';
import { Stack } from 'expo-router'; 

const { width, height } = Dimensions.get('window');

const EXTENDED_COLORS = [
  '#ffffff', '#aaaaaa', '#444444', '#000000', 
  '#ff4444', '#ff9900', '#ffff44', '#44ff44', 
  '#00ffff', '#007AFF', '#9900ff', '#ff00ff'
];
const TAG_COLORS = ['#007AFF', '#ff4444', '#ffff44', '#44ff44', '#9900ff', '#ff9900', '#00ffff'];
const SIZES = [2, 5, 10]; 

export default function NeuralNoteApp() {
  // --- SETTINGS & THEME STATE ---
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [nodeColor, setNodeColor] = useState('#007AFF');
  const [isSettingsMenuVisible, setIsSettingsMenuVisible] = useState(false);
  const [isDraggingAnyNode, setIsDraggingAnyNode] = useState(false);

  const theme = {
    bg: isDarkMode ? '#0f0f12' : '#f4f4f8',
    panel: isDarkMode ? '#1a1a1e' : '#ffffff',
    text: isDarkMode ? '#ffffff' : '#111111',
    subText: isDarkMode ? '#aaaaaa' : '#666666',
    border: isDarkMode ? '#333333' : '#dddddd',
    grid: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.05)',
  };

  // --- NOTEBOOK STATE ---
  const [notebooks, setNotebooks] = useState([{ id: '1', name: 'Notebook 1', nodes: [], connections: [] }]);
  const [activeNotebookId, setActiveNotebookId] = useState('1');
  const [isSearchingNotebooks, setIsSearchingNotebooks] = useState(false);
  const [notebookSearchQuery, setNotebookSearchQuery] = useState('');
  
  const [isEditNotebookModalVisible, setIsEditNotebookModalVisible] = useState(false);
  const [editingNotebookName, setEditingNotebookName] = useState('');

  const lastTapRef = useRef({});
  const activeNotebook = notebooks.find(nb => nb.id === activeNotebookId) || notebooks[0];
  const nodes = activeNotebook.nodes || [];
  const connections = activeNotebook.connections || [];

  const updateActiveNotebook = (updates) => {
    setNotebooks(prev => prev.map(nb => nb.id === activeNotebookId ? { ...nb, ...updates } : nb));
  };

  // --- APP STATE ---
  const [currentScreen, setCurrentScreen] = useState('graph'); 
  const [editingNodeId, setEditingNodeId] = useState(null);
  
  // Graph Panning State
  const [graphPan, setGraphPan] = useState({ x: 0, y: 0 });
  const isPanningGraph = useRef(false);
  const [isDraggingNodeUI, setIsDraggingNodeUI] = useState(false);

  // Canvas Content State
  const [elements, setElements] = useState([]); 
  const [activePageType, setActivePageType] = useState('blank'); 
  const [activeTags, setActiveTags] = useState([]); 
  const [newTagInput, setNewTagInput] = useState(''); 
  const [activeTool, setActiveTool] = useState('select'); 
  const [selectedElementId, setSelectedElementId] = useState(null);
  
  // Undo/Redo State
  const [pastElements, setPastElements] = useState([]);
  const [futureElements, setFutureElements] = useState([]);
  const [textSnapshot, setTextSnapshot] = useState(null); 
  
  // Canvas Customization State
  const [strokeColor, setStrokeColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(5); 
  const [textColor, setTextColor] = useState('#ffffff');
  const [textFormat, setTextFormat] = useState({ bold: false, italic: false, underline: false });

  // Modals & Menus
  const [isColorPickerVisible, setIsColorPickerVisible] = useState(false);
  const [colorPickerTarget, setColorPickerTarget] = useState('pen'); 
  const [isSideMenuVisible, setIsSideMenuVisible] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [isClearConfirmVisible, setIsClearConfirmVisible] = useState(false);

  // Interaction State
  const [currentPath, setCurrentPath] = useState([]);
  const [interaction, setInteraction] = useState(null); 
  
  // Graph Connection State
  const [linkingState, setLinkingState] = useState(null); 
  const [selectedLineId, setSelectedLineId] = useState(null);

  const draggingNodeId = useRef(null); 
  const dragDistance = useRef(0);

  // --- NEURI CHATBOT STATE ---
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hi! I am Neuri, your AI study buddy. What are we learning today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isNeuriTyping, setIsNeuriTyping] = useState(false);

  // --- NEURI API INTEGRATION (CONTEXT AWARE + 2.5 FLASH) ---
  const handleSendToNeuri = async () => {
    if (!chatInput.trim()) return;

    // 1. Immediately show the user's message in the UI
    const userMessage = { role: 'user', content: chatInput.trim() };
    const newMessages = [...chatMessages, userMessage];
    
    setChatMessages(newMessages);
    setChatInput('');
    setIsNeuriTyping(true);

    try {
      const API_KEY = 'AIzaSyC1ptdzezOx5D1wIVB4VHh2P3cHsIwkv-s'; 
      
      // 2. Format history for Google API (must start with 'user' role)
      const historyForAPI = newMessages.slice(1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      // 3. Magical Context Injection (RAG System)
      // Extract all text and tags from every node on the infinite canvas
      const notebookContext = notebooks.map(nb => {
        const nodeTexts = nb.nodes.map(n => {
          const textContent = n.elements.filter(el => el.type === 'text').map(el => el.text).join(' | ');
          return `  - Node "${n.title}" (Tags: ${n.tags ? n.tags.join(', ') : 'None'}): ${textContent || "(Empty node)"}`;
        }).join('\n');
        return `Notebook: ${nb.name}\n${nodeTexts}`;
      }).join('\n\n');

      const systemPrompt = `You are Neuri, a brilliant and highly encouraging AI study buddy integrated into NeuralNote, a spatial node-based note-taking app. Keep answers concise, helpful, and formatted well.
      
Here is the live content of the user's notebooks, mind-map nodes, and tags. Use this exact data to answer questions, quiz the user, or create flashcards when asked:

${notebookContext}`;

      // 4. Use Gemini 2.5 Flash as verified in your API account
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: historyForAPI 
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        const neuriReply = data.candidates[0].content.parts[0].text;
        setChatMessages(prev => [...prev, { role: 'assistant', content: neuriReply }]);
      } else {
        throw new Error('Unexpected API response structure.');
      }

    } catch (error) {
      console.error("Chatbot Fetch Error:", error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: `🚨 Connection Error: ${error.message}` }]);
    } finally {
      setIsNeuriTyping(false);
    }
  };

  // --- ADVANCED SEARCH & FILTERING LOGIC ---
  const filteredNotebooks = notebooks.filter(nb => nb.name.toLowerCase().includes(notebookSearchQuery.toLowerCase()));
  const allAvailableTags = Array.from(new Set(nodes.flatMap(n => n.tags || [])));

  const tagMatch = notebookSearchQuery.match(/#\w*$/);
  const isTypingTag = !!tagMatch;
  const tagPrefix = tagMatch ? tagMatch[0].toLowerCase() : '';
  const suggestedTags = isTypingTag ? allAvailableTags.filter(t => t.toLowerCase().startsWith(tagPrefix)) : [];

  const searchedTags = notebookSearchQuery.match(/#\w+/g) || [];
  const textQuery = notebookSearchQuery.replace(/#\w+/g, '').replace(/\band\b/gi, '').replace(/,/g, '').trim().toLowerCase();

  const visibleNodes = (searchedTags.length > 0 || textQuery) 
    ? nodes.filter(n => {
        const matchesTags = searchedTags.length === 0 || searchedTags.some(st => 
          n.tags && n.tags.some(t => t.toLowerCase() === st.toLowerCase())
        );
        const matchesText = !textQuery || n.title.toLowerCase().includes(textQuery);
        return matchesTags && matchesText;
      })
    : nodes;

  // --- NOTEBOOK LOGIC ---
  const addNewNotebook = () => {
    const newNb = { id: Date.now().toString(), name: `Notebook ${notebooks.length + 1}`, nodes: [], connections: [] };
    setNotebooks([...notebooks, newNb]);
    setActiveNotebookId(newNb.id);
  };

  const saveNotebookName = () => {
    setNotebooks(prev => prev.map(nb => nb.id === activeNotebookId ? { ...nb, name: editingNotebookName } : nb));
    setIsEditNotebookModalVisible(false);
  };

  // --- UNDO / REDO LOGIC ---
  const saveHistorySnapshot = (newElementsState) => {
    setPastElements(prev => [...prev, elements]);
    setElements(newElementsState);
    setFutureElements([]);
  };

  const handleUndo = () => {
    if (pastElements.length === 0) return;
    const previous = pastElements[pastElements.length - 1];
    setPastElements(prev => prev.slice(0, -1));
    setFutureElements(prev => [elements, ...prev]);
    setElements(previous);
    setSelectedElementId(null);
  };

  const handleRedo = () => {
    if (futureElements.length === 0) return;
    const next = futureElements[0];
    setFutureElements(prev => prev.slice(1));
    setPastElements(prev => [...prev, elements]);
    setElements(next);
    setSelectedElementId(null);
  };

  // --- TEXT FORMATTING LOGIC ---
  const toggleTextFormat = (formatKey) => {
    if (selectedElementId) {
      setElements(els => els.map(el => {
        if (el.id === selectedElementId && el.type === 'text') {
          return { ...el, [formatKey]: !el[formatKey] };
        }
        return el;
      }));
      setTextFormat(prev => ({ ...prev, [formatKey]: !prev[formatKey] }));
    } else {
      setTextFormat(prev => ({ ...prev, [formatKey]: !prev[formatKey] }));
    }
  };

  const selectColor = (color) => {
    if (colorPickerTarget === 'pen') setStrokeColor(color);
    else if (colorPickerTarget === 'node') setNodeColor(color);
    else {
      setTextColor(color);
      if (selectedElementId) setElements(els => els.map(el => el.id === selectedElementId && el.type === 'text' ? { ...el, color: color } : el));
    }
    setIsColorPickerVisible(false);
  };

  // --- KEYBOARD LISTENER FOR BACKSPACE DELETION ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedLineId) {
        setNotebooks(prev => prev.map(nb => {
          if (nb.id === activeNotebookId) return { ...nb, connections: nb.connections.filter(c => c.id !== selectedLineId) };
          return nb;
        }));
        setSelectedLineId(null);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedLineId, activeNotebookId]);

  // --- GRAPH PLACEMENT, DELETE & CONNECTION LOGIC ---
  const getNewNodePosition = (index) => {
    const centerX = (width / 2) - graphPan.x;
    const centerY = (height / 2) - graphPan.y;
    const angle = index * 0.8; 
    const radius = 70 * Math.sqrt(index); 
    return { x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
  };

  const deleteNode = (nodeId) => {
    setNotebooks(prev => prev.map(nb => {
      if (nb.id === activeNotebookId) {
        return {
          ...nb,
          nodes: nb.nodes.filter(n => n.id !== nodeId),
          connections: nb.connections.filter(c => c.from !== nodeId && c.to !== nodeId)
        };
      }
      return nb;
    }));
  };

  const handleNodePointerUp = (e, node) => {
    draggingNodeId.current = null;
    setIsDraggingNodeUI(false);
    setIsDraggingAnyNode(false);
    try { e.target.releasePointerCapture(e.nativeEvent.pointerId); } catch(err){}

    const clientX = e.nativeEvent.pageX || e.nativeEvent.clientX || 0;
    const clientY = e.nativeEvent.pageY || e.nativeEvent.clientY || 0;

    if (clientX > 20 && clientX < 130 && clientY > height - 130 && clientY < height - 20) {
      deleteNode(node.id);
    }
  };

  const handleNodePress = (node) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[node.id] || 0;

    if (now - lastTap < 300) {
      setLinkingState(null);
      setSelectedLineId(null);
      openNote(node);
    } else {
      if (linkingState) {
        if (linkingState.fromNodeId !== node.id) {
          const exists = connections.find(c => 
            (c.from === linkingState.fromNodeId && c.to === node.id) || 
            (c.from === node.id && c.to === linkingState.fromNodeId)
          );
          if (!exists) {
            const newConn = { id: Date.now().toString(), from: linkingState.fromNodeId, to: node.id };
            updateActiveNotebook({ connections: [...connections, newConn] });
          }
        }
        setLinkingState(null);
      } else {
        setLinkingState({ fromNodeId: node.id, pointerX: node.x, pointerY: node.y });
        setSelectedLineId(null);
      }
    }
    lastTapRef.current[node.id] = now;
  };

  const openNote = (node) => {
    setEditingNodeId(node?.id || null);
    setElements(node?.elements || []);
    setActivePageType(node?.pageType || 'blank'); 
    setActiveTags(node?.tags || []); 
    setPastElements([]);    
    setFutureElements([]);
    setCurrentScreen('canvas');
    setActiveTool('select');
  };

  // --- CANVAS POINTER LOGIC (INC. ERASER) ---
  const handleCanvasPointerDown = (e) => {
    const x = e.nativeEvent.offsetX || e.nativeEvent.locationX;
    const y = e.nativeEvent.offsetY || e.nativeEvent.locationY;
    setSelectedElementId(null); 
    
    if (activeTool === 'pen') {
      setInteraction({ type: 'pen' });
      setCurrentPath([`${x.toFixed(0)},${y.toFixed(0)}`]);
    } 
    else if (activeTool === 'eraser') {
      setInteraction({ type: 'erasing', startElements: elements, hasErased: false });
    }
    else if (activeTool === 'text') {
      setInteraction({ type: 'drafting_text', startX: x, startY: y, curX: x, curY: y });
    }
  };

  const handleCanvasPointerMove = (e) => {
    const x = e.nativeEvent.offsetX || e.nativeEvent.locationX;
    const y = e.nativeEvent.offsetY || e.nativeEvent.locationY;
    const moveX = e.nativeEvent.movementX;
    const moveY = e.nativeEvent.movementY;

    if (!interaction) return;

    if (interaction.type === 'pen' && x && y) {
      setCurrentPath(prev => [...prev, `${x.toFixed(0)},${y.toFixed(0)}`]);
    } 
    else if (interaction.type === 'erasing') {
      const eraseRadius = Math.max(strokeWidth * 2, 10);
      setElements(prevEls => {
        let hasJustErased = false;
        const remainingElements = prevEls.filter(el => {
            if (el.type !== 'path') return true;
            const points = el.d.match(/-?\d+\.?\d*,-?\d+\.?\d*/g) || [];
            for (let i = 0; i < points.length; i += 2) { 
                const [ex, ey] = points[i].split(',').map(Number);
                if (Math.hypot(ex - x, ey - y) < eraseRadius) {
                    hasJustErased = true;
                    return false; 
                }
            }
            return true;
        });

        if (hasJustErased && !interaction.hasErased) {
            setInteraction(prev => ({ ...prev, hasErased: true }));
        }
        return hasJustErased ? remainingElements : prevEls;
      });
    }
    else if (interaction.type === 'drafting_text') {
      setInteraction(prev => ({ ...prev, curX: x, curY: y }));
    } 
    else if (interaction.type === 'moving') {
      setElements(els => els.map(el => el.id === interaction.id ? { ...el, x: el.x + moveX, y: el.y + moveY } : el));
    } 
    else if (interaction.type === 'resizing') {
      setElements(els => els.map(el => el.id === interaction.id ? { 
        ...el, width: Math.max(50, el.width + moveX), height: Math.max(30, el.height + moveY) 
      } : el));
    }
  };

  const handleCanvasPointerUp = () => {
    if (!interaction) return;

    if (interaction.type === 'pen' && currentPath.length > 0) {
      const newPath = { id: Date.now().toString(), type: 'path', d: `M${currentPath.join(' L')}`, color: strokeColor, width: strokeWidth };
      saveHistorySnapshot([...elements, newPath]);
      setCurrentPath([]);
    } 
    else if (interaction.type === 'erasing') {
      if (interaction.hasErased) {
        setPastElements(prev => [...prev, interaction.startElements]);
        setFutureElements([]);
      }
    }
    else if (interaction.type === 'drafting_text') {
      let { startX, startY, curX, curY } = interaction;
      let w = Math.abs(curX - startX);
      let h = Math.abs(curY - startY);
      if (w < 20 || h < 20) { w = 150; h = 50; }

      const newText = { 
        id: Date.now().toString(), type: 'text', 
        x: Math.min(startX, curX), y: Math.min(startY, curY), 
        width: w, height: h, text: '', 
        color: textColor, bold: textFormat.bold, italic: textFormat.italic, underline: textFormat.underline 
      };
      saveHistorySnapshot([...elements, newText]);
      setSelectedElementId(newText.id); 
      setActiveTool('select'); 
    }
    else if (interaction.type === 'moving' || interaction.type === 'resizing') {
      setPastElements(prev => [...prev, interaction.originalElements]);
      setFutureElements([]);
    }
    setInteraction(null);
  };

  const handleElementPointerDown = (e, id, type) => {
    e.stopPropagation(); 
    if (activeTool === 'select') {
      setSelectedElementId(id);
      setInteraction({ type: type, id: id, originalElements: [...elements] }); 
      if (type === 'selecting_text_only') {
        const selectedEl = elements.find(el => el.id === id);
        if (selectedEl && selectedEl.type === 'text') {
          setTextFormat({ bold: selectedEl.bold, italic: selectedEl.italic, underline: selectedEl.underline });
        }
      }
    }
  };

  const updateText = (id, val) => { setElements(elements.map(el => el.id === id ? { ...el, text: val } : el)); };
  const removeElement = (id) => { saveHistorySnapshot(elements.filter(el => el.id !== id)); setSelectedElementId(null); };
  const clearAllElements = () => { saveHistorySnapshot([]); setIsClearConfirmVisible(false); };

  const handleAddTag = () => {
    const rawTag = newTagInput.trim();
    if (rawTag) {
      const formattedTag = rawTag.startsWith('#') ? rawTag : `#${rawTag}`;
      if (!activeTags.includes(formattedTag)) setActiveTags([...activeTags, formattedTag]);
      setNewTagInput('');
    }
  };

  const handleSaveAttempt = () => {
    if (editingNodeId) {
      updateActiveNotebook({ nodes: nodes.map(n => n.id === editingNodeId ? { ...n, elements, pageType: activePageType, tags: activeTags } : n) });
      setCurrentScreen('graph');
    } else {
      setIsModalVisible(true);
    }
  };

  const confirmSaveNode = () => {
    const defaultName = `Node ${nodes.length + 1}`;
    const pos = getNewNodePosition(nodes.length);
    const newNode = { id: Date.now().toString(), title: newNodeTitle.trim() === '' ? defaultName : newNodeTitle, x: pos.x, y: pos.y, elements, pageType: activePageType, tags: activeTags };
    updateActiveNotebook({ nodes: [...nodes, newNode] });
    setNewNodeTitle('');
    setIsModalVisible(false);
    setCurrentScreen('graph');
  };

  // --- RENDER GRAPH ---
  if (currentScreen === 'graph') {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        <View style={{position: 'absolute', top: 40, right: 30, zIndex: 20, flexDirection: 'row', gap: 20}}>
          <TouchableOpacity onPress={() => setIsChatVisible(true)}>
            <Text style={{fontSize: 26}}>🤖</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsSettingsMenuVisible(true)}>
            <Text style={{fontSize: 26}}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.topNavContainer} pointerEvents={isDraggingNodeUI ? 'none' : 'auto'}>
          <View style={styles.searchWrapper}>
            <View style={[styles.notebookTabBar, { backgroundColor: theme.panel, borderColor: theme.border }]}>
              {isSearchingNotebooks ? (
                <View style={styles.searchContainer}>
                  <TextInput 
                    style={[styles.notebookSearchInput, { color: theme.text }]} 
                    placeholder="Search notebooks or type #tags..." 
                    placeholderTextColor={theme.subText} 
                    value={notebookSearchQuery} 
                    onChangeText={setNotebookSearchQuery} 
                    autoFocus 
                  />
                  <TouchableOpacity onPress={() => { setIsSearchingNotebooks(false); setNotebookSearchQuery(''); }}>
                    <Text style={[styles.cancelText, { color: theme.subText }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TouchableOpacity style={styles.navIconBtn} onPress={() => setIsSearchingNotebooks(true)}>
                    <Text style={{ fontSize: 20, color: theme.subText }}>🔍</Text>
                  </TouchableOpacity>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.notebookScroll} contentContainerStyle={{alignItems: 'center'}}>
                    {notebooks.map(nb => {
                      const isActive = activeNotebookId === nb.id;
                      return (
                        <TouchableOpacity key={nb.id} style={[styles.notebookTab, isActive && { backgroundColor: isDarkMode ? '#2d2d34' : '#e5e5e5' }]} onPress={() => {
                            const now = Date.now();
                            const lastTap = lastTapRef.current[`nb-${nb.id}`] || 0;
                            if (now - lastTap < 300) { setEditingNotebookName(nb.name); setIsEditNotebookModalVisible(true); } 
                            else { setActiveNotebookId(nb.id); }
                            lastTapRef.current[`nb-${nb.id}`] = now;
                          }}>
                          <Text style={[styles.notebookTabText, { color: isActive ? '#007AFF' : theme.subText }]}>{nb.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                  <TouchableOpacity style={styles.addNotebookBtn} onPress={addNewNotebook}><Text style={styles.addNotebookBtnText}>+</Text></TouchableOpacity>
                </>
              )}
            </View>

            {isSearchingNotebooks && (
              <View style={[styles.searchResultsDropdown, { backgroundColor: theme.panel, borderColor: theme.border }]}>
                <ScrollView style={{ maxHeight: 200 }}>
                  {isTypingTag ? (
                    suggestedTags.length > 0 ? (
                      suggestedTags.map(tag => (
                        <TouchableOpacity key={`search-tag-${tag}`} style={[styles.searchResultItem, { borderBottomColor: theme.border }]} onPress={() => setNotebookSearchQuery(prev => prev.replace(/#\w*$/, tag + ' '))}>
                          <Text style={{ color: theme.text, fontSize: 16 }}>🏷️ {tag}</Text>
                        </TouchableOpacity>
                      ))
                    ) : (<Text style={{ color: theme.subText, padding: 20, textAlign: 'center', fontStyle: 'italic' }}>No matching tags found...</Text>)
                  ) : notebookSearchQuery.includes('#') ? (
                    <Text style={{ color: theme.subText, padding: 20, textAlign: 'center', fontStyle: 'italic' }}>Filtering canvas by tags...</Text>
                  ) : (
                    filteredNotebooks.length > 0 ? (
                      filteredNotebooks.map(nb => (
                        <TouchableOpacity key={`search-${nb.id}`} style={[styles.searchResultItem, { borderBottomColor: theme.border }]} onPress={() => { setActiveNotebookId(nb.id); setIsSearchingNotebooks(false); setNotebookSearchQuery(''); }}>
                          <Text style={{ color: theme.text, fontSize: 16 }}>🗂️ {nb.name}</Text>
                        </TouchableOpacity>
                      ))
                    ) : (<Text style={{ color: theme.subText, padding: 20, textAlign: 'center', fontStyle: 'italic' }}>No notebooks found...</Text>)
                  )}
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        <View 
          style={[styles.graphContainer, { cursor: isPanningGraph.current ? 'grabbing' : (linkingState ? 'crosshair' : 'grab') }]}
          onPointerDown={() => {
            isPanningGraph.current = true;
            setLinkingState(null);
            setSelectedLineId(null);
          }}
          onPointerMove={(e) => {
            if (isPanningGraph.current) {
              setGraphPan(prev => ({ x: prev.x + e.nativeEvent.movementX, y: prev.y + e.nativeEvent.movementY }));
            } else if (linkingState) {
              setLinkingState(prev => ({ ...prev, pointerX: prev.pointerX + e.nativeEvent.movementX, pointerY: prev.pointerY + e.nativeEvent.movementY }));
            }
          }}
          onPointerUp={() => isPanningGraph.current = false}
          onPointerLeave={() => isPanningGraph.current = false}
        >
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
            <Defs><Pattern id="bg-grid" width="40" height="40" patternUnits="userSpaceOnUse" x={graphPan.x} y={graphPan.y}><Path d="M 40 0 L 0 0 0 40" fill="none" stroke={theme.grid} strokeWidth="1" /></Pattern></Defs>
            <Rect x="-5000" y="-5000" width="10000" height="10000" fill="url(#bg-grid)" />
          </Svg>

          <View style={[StyleSheet.absoluteFill, { transform: [{ translateX: graphPan.x }, { translateY: graphPan.y }] }]}>
            <Svg height="100%" width="100%" style={{ overflow: 'visible', position: 'absolute' }}>
              {connections.map((conn) => {
                const n1 = visibleNodes.find(n => n.id === conn.from);
                const n2 = visibleNodes.find(n => n.id === conn.to);
                if (!n1 || !n2) return null; 
                const isSelected = selectedLineId === conn.id;
                return (
                  <React.Fragment key={conn.id}>
                    <Line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke={isSelected ? "#007AFF" : (isDarkMode ? "#444" : "#ccc")} strokeWidth={isSelected ? "4" : "2"} />
                    <Line x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="transparent" strokeWidth="25" onPointerDown={(e) => { e.stopPropagation(); setSelectedLineId(conn.id); }} style={{ cursor: 'pointer' }} />
                  </React.Fragment>
                );
              })}
              {linkingState && (() => {
                const originNode = visibleNodes.find(n => n.id === linkingState.fromNodeId);
                if (!originNode) return null;
                return <Line x1={originNode.x} y1={originNode.y} x2={linkingState.pointerX} y2={linkingState.pointerY} stroke="#007AFF" strokeWidth="2" strokeDasharray="6, 6" />;
              })()}
            </Svg>

            {connections.map((conn) => {
              if (selectedLineId !== conn.id) return null;
              const n1 = visibleNodes.find(n => n.id === conn.from);
              const n2 = visibleNodes.find(n => n.id === conn.to);
              if (!n1 || !n2) return null;
              const midX = (n1.x + n2.x) / 2;
              const midY = (n1.y + n2.y) / 2;
              return (
                <TouchableOpacity key={`del-${conn.id}`} style={[styles.deleteLineBtn, { left: midX - 12, top: midY - 12 }]} onPress={() => { updateActiveNotebook({ connections: connections.filter(c => c.id !== conn.id) }); setSelectedLineId(null); }}>
                  <Text style={{color: 'white', fontSize: 12, fontWeight: 'bold'}}>✕</Text>
                </TouchableOpacity>
              );
            })}

            {visibleNodes.map((node) => (
              <View 
                key={node.id} 
                style={[styles.nodeWrapper, { left: node.x - 40, top: node.y - 22 }]} 
                onPointerDown={(e) => {
                  e.stopPropagation(); 
                  draggingNodeId.current = node.id; 
                  setIsDraggingNodeUI(true);
                  setIsDraggingAnyNode(true);
                  dragDistance.current = 0;
                  try { e.target.setPointerCapture(e.nativeEvent.pointerId); } catch(err){}
                }} 
                onPointerMove={(e) => {
                  e.stopPropagation();
                  if (draggingNodeId.current === node.id) {
                    const moveX = e.nativeEvent.movementX;
                    const moveY = e.nativeEvent.movementY;
                    dragDistance.current += Math.abs(moveX) + Math.abs(moveY);
                    
                    setNotebooks(prev => prev.map(nb => nb.id === activeNotebookId ? { 
                      ...nb, nodes: nb.nodes.map(n => n.id === node.id ? { ...n, x: n.x + moveX, y: n.y + moveY } : n) 
                    } : nb));

                    if (linkingState && linkingState.fromNodeId === node.id) {
                      setLinkingState(prev => ({ ...prev, pointerX: prev.pointerX + moveX, pointerY: prev.pointerY + moveY }));
                    }
                  } else if (linkingState && draggingNodeId.current === null) {
                    setLinkingState(prev => ({ ...prev, pointerX: node.x, pointerY: node.y }));
                  }
                }}
                onPointerUp={(e) => handleNodePointerUp(e, node)}
              >
                <TouchableOpacity activeOpacity={0.7} style={[styles.nodeCircle, { backgroundColor: nodeColor, borderColor: theme.panel }]} onPress={() => { if (dragDistance.current < 5) handleNodePress(node); }} />
                <Text style={[styles.nodeLabel, { color: theme.text }]}>{node.title}</Text>
              </View>
            ))}
          </View>
          
          {visibleNodes.length === 0 && (
            <Text style={[styles.hint, { position: 'absolute', width: '100%', top: height / 2.5, color: theme.subText }]}>
              {nodes.length === 0 ? "Notebook is empty. Tap + to start." : "No nodes match your tags."}
            </Text>
          )}
        </View>

        <View style={[styles.trashCan, { backgroundColor: isDraggingAnyNode ? '#ff4444' : theme.panel, borderColor: isDraggingAnyNode ? '#ff0000' : theme.border, transform: [{scale: isDraggingAnyNode ? 1.15 : 1}] }]}>
          <Text style={{fontSize: 28}}>🗑️</Text>
        </View>
        <TouchableOpacity style={styles.fab} onPress={() => openNote(null)}><Text style={styles.fabText}>+</Text></TouchableOpacity>

        {isSettingsMenuVisible && (
          <TouchableOpacity style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 15 }} activeOpacity={1} onPress={() => setIsSettingsMenuVisible(false)}>
            <View style={[styles.settingsDropdown, { backgroundColor: theme.panel, borderColor: theme.border }]}>
              <TouchableOpacity style={[styles.settingsOption, { borderBottomColor: theme.border }]}><Text style={{color: theme.text, fontSize: 16}}>👤 Account</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.settingsOption, { borderBottomColor: theme.border }]} onPress={() => setIsDarkMode(!isDarkMode)}><Text style={{color: theme.text, fontSize: 16}}>{isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.settingsOption, { borderBottomColor: theme.border }]} onPress={() => { setIsSettingsMenuVisible(false); setColorPickerTarget('node'); setIsColorPickerVisible(true); }}><Text style={{color: theme.text, fontSize: 16}}>🎨 Appearance</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.settingsOption, { borderBottomWidth: 0 }]}><Text style={{color: theme.text, fontSize: 16}}>↗️ Share</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}

        {/* NEURI CHATBOT MODAL (GRAPH SCREEN) */}
        <Modal visible={isChatVisible} transparent animationType="slide">
          <View style={styles.chatOverlay}>
            <View style={[styles.chatContainer, { backgroundColor: theme.panel, borderColor: theme.border }]}>
              <View style={[styles.chatHeader, { borderBottomColor: theme.border }]}>
                <Text style={[styles.chatTitle, { color: theme.text }]}>🤖 Neuri</Text>
                <TouchableOpacity onPress={() => setIsChatVisible(false)}><Text style={{ color: '#ff4444', fontSize: 18, fontWeight: 'bold' }}>✕</Text></TouchableOpacity>
              </View>
              
              <ScrollView style={styles.chatScroll} contentContainerStyle={{ padding: 15 }}>
                {chatMessages.map((msg, idx) => (
                  <View key={idx} style={[styles.chatBubble, msg.role === 'user' ? [styles.userBubble, { backgroundColor: '#007AFF' }] : [styles.neuriBubble, { backgroundColor: isDarkMode ? '#2d2d34' : '#e5e5ea' }]]}>
                    <Text style={{ color: msg.role === 'user' ? '#fff' : theme.text, fontSize: 15 }}>{msg.content}</Text>
                  </View>
                ))}
                {isNeuriTyping && <ActivityIndicator size="small" color="#007AFF" style={{ alignSelf: 'flex-start', marginVertical: 10 }} />}
              </ScrollView>

              <View style={[styles.chatInputContainer, { borderTopColor: theme.border }]}>
                <TextInput 
                  style={[styles.chatInput, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]} 
                  placeholder="Ask Neuri a question..." 
                  placeholderTextColor={theme.subText}
                  value={chatInput}
                  onChangeText={setChatInput}
                  onSubmitEditing={handleSendToNeuri}
                />
                <TouchableOpacity style={styles.chatSendBtn} onPress={handleSendToNeuri} disabled={isNeuriTyping}>
                  <Text style={{color: '#fff', fontWeight: 'bold'}}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={isEditNotebookModalVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: theme.panel, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Rename Notebook</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]} value={editingNotebookName} onChangeText={setEditingNotebookName} autoFocus />
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={() => setIsEditNotebookModalVisible(false)} style={[styles.modalBtn, {backgroundColor: '#444'}]}><Text style={{color: '#fff'}}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={saveNotebookName} style={[styles.modalBtn, {backgroundColor: '#007AFF'}]}><Text style={{color: '#fff'}}>Save</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={isColorPickerVisible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.colorPickerContent, { backgroundColor: theme.panel, borderColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Select Node Color</Text>
              <View style={styles.colorGrid}>
                {EXTENDED_COLORS.map(c => (
                  <TouchableOpacity key={c} onPress={() => selectColor(c)} style={[styles.largeColorDot, { backgroundColor: c, borderColor: nodeColor === c ? '#007AFF' : '#444' }]} />
                ))}
              </View>
              <TouchableOpacity onPress={() => setIsColorPickerVisible(false)} style={[styles.modalBtn, {backgroundColor: '#444', width: '100%', marginTop: 20}]}><Text style={{color: '#fff'}}>Close</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // --- RENDER CANVAS ---
  const getCursor = () => {
    if (activeTool === 'pen') return 'crosshair';
    if (activeTool === 'eraser') return 'crosshair';
    if (activeTool === 'text') return 'cell'; 
    return 'default';
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.canvasHeader}>
        <TouchableOpacity style={styles.hamburgerBtn} onPress={() => setIsSideMenuVisible(true)}>
          <Text style={{ fontSize: 30, color: theme.text }}>☰</Text>
        </TouchableOpacity>

        <View style={[styles.pillToolbar, { backgroundColor: theme.panel, borderColor: theme.border }]}>
          <TouchableOpacity onPress={handleUndo} disabled={pastElements.length === 0} style={[styles.iconBtn, pastElements.length === 0 && {opacity: 0.3}]}><Text style={{ color: theme.text, fontSize: 18 }}>↶</Text></TouchableOpacity>
          <TouchableOpacity onPress={handleRedo} disabled={futureElements.length === 0} style={[styles.iconBtn, futureElements.length === 0 && {opacity: 0.3}]}><Text style={{ color: theme.text, fontSize: 18 }}>↷</Text></TouchableOpacity>
          
          <View style={styles.divider} />
          
          <TouchableOpacity onPress={() => toggleTextFormat('bold')} style={[styles.iconBtn, textFormat.bold && { backgroundColor: isDarkMode ? '#3a3a3e' : '#e0e0e5' }]}><Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>B</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => toggleTextFormat('italic')} style={[styles.iconBtn, textFormat.italic && { backgroundColor: isDarkMode ? '#3a3a3e' : '#e0e0e5' }]}><Text style={{ color: theme.text, fontSize: 18, fontStyle: 'italic' }}>I</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => toggleTextFormat('underline')} style={[styles.iconBtn, textFormat.underline && { backgroundColor: isDarkMode ? '#3a3a3e' : '#e0e0e5' }]}><Text style={{ color: theme.text, fontSize: 18, textDecorationLine: 'underline' }}>U</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTool('text')} style={[styles.iconBtn, activeTool === 'text' && { backgroundColor: isDarkMode ? '#3a3a3e' : '#e0e0e5' }, {marginLeft: 5}]}><Text style={{ color: theme.text, fontSize: 18 }}>📄</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => { setColorPickerTarget('text'); setIsColorPickerVisible(true); }} style={styles.iconBtn}><Text style={{ color: textColor, fontWeight: '800', fontSize: 20 }}>A</Text></TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity onPress={() => setActiveTool(activeTool === 'pen' ? 'select' : 'pen')} style={[styles.iconBtn, activeTool === 'pen' && { backgroundColor: isDarkMode ? '#3a3a3e' : '#e0e0e5' }]}><Text style={{ color: theme.text, fontSize: 18 }}>🖊️</Text></TouchableOpacity>
          
          <TouchableOpacity onPress={() => setActiveTool(activeTool === 'eraser' ? 'select' : 'eraser')} style={[styles.iconBtn, activeTool === 'eraser' && { backgroundColor: isDarkMode ? '#3a3a3e' : '#e0e0e5' }]}><Text style={{ color: theme.text, fontSize: 18 }}>🧽</Text></TouchableOpacity>
          
          {SIZES.map(s => (
            <TouchableOpacity key={s} onPress={() => setStrokeWidth(s)} style={[styles.sizeBtn, strokeWidth === s && { backgroundColor: isDarkMode ? '#3a3a3e' : '#e0e0e5' }]}>
              <View style={{width: s, height: s, borderRadius: s/2, backgroundColor: theme.text }} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => { setColorPickerTarget('pen'); setIsColorPickerVisible(true); }} style={[styles.iconBtn, {marginLeft: 5}]}><Text style={{ color: theme.text, fontSize: 18 }}>🎨</Text></TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setIsChatVisible(true)} style={[styles.actionBtnSecondary, { backgroundColor: isDarkMode ? '#2a2a2e' : '#e5e5ea', borderColor: theme.border, marginRight: 5 }]}>
            <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>🤖 Neuri</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsClearConfirmVisible(true)} style={[styles.actionBtnSecondary, { backgroundColor: isDarkMode ? '#2a2a2e' : '#e5e5ea', borderColor: theme.border }]}><Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }}>Clear</Text></TouchableOpacity>
          <TouchableOpacity onPress={handleSaveAttempt} style={styles.actionBtnPrimary}><Text style={styles.btnTextPrimary}>Save</Text></TouchableOpacity>
        </View>
      </View>

      <View style={[styles.canvas, { cursor: getCursor() }]} onPointerDown={handleCanvasPointerDown} onPointerMove={handleCanvasPointerMove} onPointerUp={handleCanvasPointerUp} onPointerLeave={handleCanvasPointerUp}>
        <Svg height={height} width={width} style={StyleSheet.absoluteFill}>
          <Defs>
            <Pattern id="lined" width={width} height="40" patternUnits="userSpaceOnUse"><Line x1="0" y1="40" x2={width} y2="40" stroke={theme.grid} strokeWidth="1" /></Pattern>
            <Pattern id="graph" width="40" height="40" patternUnits="userSpaceOnUse"><Path d="M 40 0 L 0 0 0 40" fill="none" stroke={theme.grid} strokeWidth="1" /></Pattern>
            <Pattern id="dotted" width="40" height="40" patternUnits="userSpaceOnUse"><Circle cx="20" cy="20" r="2" fill={theme.grid} /></Pattern>
          </Defs>
          {activePageType === 'lined' && <Rect width="100%" height="100%" fill="url(#lined)" />}
          {activePageType === 'graph' && <Rect width="100%" height="100%" fill="url(#graph)" />}
          {activePageType === 'dotted' && <Rect width="100%" height="100%" fill="url(#dotted)" />}

          {elements.filter(el => el.type === 'path').map((p) => <Path key={p.id} d={p.d} stroke={p.color} strokeWidth={p.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          {currentPath.length > 0 && <Path d={`M${currentPath.join(' L')}`} stroke={strokeColor} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </Svg>
        
        {interaction?.type === 'drafting_text' && <View style={[styles.draftingBox, { left: Math.min(interaction.startX, interaction.curX), top: Math.min(interaction.startY, interaction.curY), width: Math.abs(interaction.curX - interaction.startX), height: Math.abs(interaction.curY - interaction.startY), borderColor: textColor }]} />}

        {elements.filter(el => el.type === 'text').map((t) => {
          const isSelected = selectedElementId === t.id;
          return (
            <View 
              key={t.id} 
              style={[styles.textWrapper, { left: t.x, top: t.y, width: t.width, height: t.height, borderColor: isSelected ? '#007AFF' : 'transparent' }]} 
              onPointerDown={(e) => handleElementPointerDown(e, t.id, 'selecting_text_only')}
            >
              {isSelected && <View style={styles.moveHandle} onPointerDown={(e) => handleElementPointerDown(e, t.id, 'moving')}><Text style={styles.moveHandleIcon}>✛</Text></View>}
              <TextInput 
                style={[styles.canvasInput, { color: t.color, fontWeight: t.bold ? 'bold' : 'normal', fontStyle: t.italic ? 'italic' : 'normal', textDecorationLine: t.underline ? 'underline' : 'none' }]} 
                placeholder="Type here..." 
                placeholderTextColor={theme.subText} 
                value={t.text} 
                onChangeText={(val) => updateText(t.id, val)} 
                onFocus={() => setTextSnapshot([...elements])} 
                onBlur={() => { if (textSnapshot) { setPastElements(prev => [...prev, textSnapshot]); setFutureElements([]); setTextSnapshot(null); }}} 
                multiline 
                editable={activeTool === 'select' || activeTool === 'text'} 
              />
              {isSelected && <View style={styles.resizeHandle} onPointerDown={(e) => handleElementPointerDown(e, t.id, 'resizing')} />}
              {isSelected && <TouchableOpacity style={styles.deleteTextBtn} onPress={() => removeElement(t.id)}><Text style={{color: 'white', fontSize: 10}}>✕</Text></TouchableOpacity>}
            </View>
          );
        })}
      </View>

      {/* NEURI CHATBOT MODAL (CANVAS SCREEN) */}
      <Modal visible={isChatVisible} transparent animationType="slide">
        <View style={styles.chatOverlay}>
          <View style={[styles.chatContainer, { backgroundColor: theme.panel, borderColor: theme.border }]}>
            <View style={[styles.chatHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.chatTitle, { color: theme.text }]}>🤖 Neuri</Text>
              <TouchableOpacity onPress={() => setIsChatVisible(false)}><Text style={{ color: '#ff4444', fontSize: 18, fontWeight: 'bold' }}>✕</Text></TouchableOpacity>
            </View>
            
            <ScrollView style={styles.chatScroll} contentContainerStyle={{ padding: 15 }}>
              {chatMessages.map((msg, idx) => (
                <View key={idx} style={[styles.chatBubble, msg.role === 'user' ? [styles.userBubble, { backgroundColor: '#007AFF' }] : [styles.neuriBubble, { backgroundColor: isDarkMode ? '#2d2d34' : '#e5e5ea' }]]}>
                  <Text style={{ color: msg.role === 'user' ? '#fff' : theme.text, fontSize: 15 }}>{msg.content}</Text>
                </View>
              ))}
              {isNeuriTyping && <ActivityIndicator size="small" color="#007AFF" style={{ alignSelf: 'flex-start', marginVertical: 10 }} />}
            </ScrollView>

            <View style={[styles.chatInputContainer, { borderTopColor: theme.border }]}>
              <TextInput 
                style={[styles.chatInput, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]} 
                placeholder="Ask Neuri a question..." 
                placeholderTextColor={theme.subText}
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={handleSendToNeuri}
              />
              <TouchableOpacity style={styles.chatSendBtn} onPress={handleSendToNeuri} disabled={isNeuriTyping}>
                <Text style={{color: '#fff', fontWeight: 'bold'}}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isSideMenuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.sideMenuOverlay} activeOpacity={1} onPress={() => setIsSideMenuVisible(false)}>
          <TouchableOpacity style={[styles.sideMenuContent, { backgroundColor: theme.panel, borderRightColor: theme.border }]} activeOpacity={1}>
            <Text style={[styles.sideMenuTitle, { color: theme.text }]}>Menu</Text>

            <Text style={styles.sectionTitle}>Paper Type</Text>
            {['blank', 'lined', 'graph', 'dotted'].map(type => (
              <TouchableOpacity key={type} style={[styles.menuOption, { borderBottomColor: theme.border }]} onPress={() => { setActivePageType(type); setIsSideMenuVisible(false); }}>
                <Text style={{ color: theme.text, fontSize: 16, fontWeight: '500' }}>{type.charAt(0).toUpperCase() + type.slice(1)}</Text>
                {activePageType === type && <Text style={styles.menuOptionCheck}>✓</Text>}
              </TouchableOpacity>
            ))}

            <View style={{height: 30}} />
            <Text style={styles.sectionTitle}>Tags</Text>
            
            <View style={styles.addTagContainer}>
              <TextInput
                style={[styles.addTagInput, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
                placeholder="Add tag (e.g. math)"
                placeholderTextColor={theme.subText}
                value={newTagInput}
                onChangeText={setNewTagInput}
                onSubmitEditing={handleAddTag}
              />
              <TouchableOpacity style={styles.addTagBtn} onPress={handleAddTag}>
                <Text style={styles.addTagBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }}>
              {activeTags.map((tag, index) => (
                <View key={tag} style={[styles.tagItem, { borderBottomColor: theme.border }]}>
                  <View style={{flexDirection: 'row', alignItems: 'center'}}>
                    <View style={[styles.tagDot, { backgroundColor: TAG_COLORS[index % TAG_COLORS.length] }]} />
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '500' }}>{tag}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setActiveTags(activeTags.filter(t => t !== tag))}>
                    <Text style={{color: '#ff4444', fontSize: 16}}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isColorPickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.colorPickerContent, { backgroundColor: theme.panel, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Select {colorPickerTarget === 'pen' ? 'Pen' : colorPickerTarget === 'node' ? 'Node' : 'Text'} Color</Text>
            <View style={styles.colorGrid}>
              {EXTENDED_COLORS.map(c => (
                <TouchableOpacity key={c} onPress={() => selectColor(c)} style={[styles.largeColorDot, { backgroundColor: c, borderColor: (colorPickerTarget === 'pen' ? strokeColor : colorPickerTarget === 'node' ? nodeColor : textColor) === c ? '#007AFF' : '#444' }]} />
              ))}
            </View>
            <TouchableOpacity onPress={() => setIsColorPickerVisible(false)} style={[styles.modalBtn, {backgroundColor: '#444', width: '100%', marginTop: 20}]}><Text style={{color: '#fff'}}>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isClearConfirmVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.panel, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Clear Note</Text>
            <Text style={{color: theme.subText, marginBottom: 20, fontSize: 16}}>Are you sure you want to clear this note?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setIsClearConfirmVisible(false)} style={[styles.modalBtn, {backgroundColor: '#444'}]}><Text style={{color: '#fff'}}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={clearAllElements} style={[styles.modalBtn, {backgroundColor: '#ff4444'}]}><Text style={{color: '#fff'}}>Clear</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.panel, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Name your note</Text>
            <TextInput style={[styles.input, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]} placeholder={`Node ${nodes.length + 1}`} placeholderTextColor={theme.subText} value={newNodeTitle} onChangeText={setNewNodeTitle} autoFocus />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={[styles.modalBtn, {backgroundColor: '#444'}]}><Text style={{color: '#fff'}}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={confirmSaveNode} style={[styles.modalBtn, {backgroundColor: '#007AFF'}]}><Text style={{color: '#fff'}}>Save Note</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' }, 
  
  topNavContainer: { position: 'absolute', top: 30, width: '100%', alignItems: 'center', zIndex: 10 },
  searchWrapper: { position: 'relative', maxWidth: '80%' }, 
  notebookTabBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 30, paddingHorizontal: 15, paddingVertical: 8, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, alignSelf: 'center' },
  notebookScroll: { marginHorizontal: 10, flexGrow: 0, flexShrink: 1 },
  notebookTab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, marginRight: 5 },
  notebookTabText: { fontWeight: '600', fontSize: 16 },
  addNotebookBtn: { paddingVertical: 8, paddingHorizontal: 12, justifyContent: 'center', marginLeft: 5 },
  addNotebookBtnText: { color: '#007AFF', fontWeight: 'bold', fontSize: 24, marginTop: -2 },
  navIconBtn: { padding: 8 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', width: 300 }, 
  notebookSearchInput: { flex: 1, fontSize: 16, paddingVertical: 8, paddingHorizontal: 10, outlineStyle: 'none' },
  cancelText: { paddingHorizontal: 10, fontWeight: 'bold' },
  searchResultsDropdown: { position: 'absolute', top: 60, left: 0, right: 0, borderRadius: 12, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, zIndex: 20, overflow: 'hidden' },
  searchResultItem: { paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1 },

  graphContainer: { flex: 1, marginTop: 0, overflow: 'hidden' },
  nodeWrapper: { position: 'absolute', width: 80, alignItems: 'center' },
  nodeCircle: { width: 44, height: 44, borderRadius: 22, marginBottom: 8, borderWidth: 2, shadowColor: '#007AFF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  nodeLabel: { fontSize: 13, textAlign: 'center', fontWeight: '500' },
  hint: { textAlign: 'center', fontSize: 16 },
  
  trashCan: { position: 'absolute', bottom: 40, left: 40, width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, borderWidth: 1 },
  fab: { position: 'absolute', bottom: 40, right: 40, width: 70, height: 70, borderRadius: 35, backgroundColor: '#007AFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  fabText: { color: '#fff', fontSize: 36, marginTop: -4 },
  
  settingsDropdown: { position: 'absolute', top: 80, right: 30, width: 160, borderRadius: 12, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, overflow: 'hidden' },
  settingsOption: { paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1 },
  
  deleteLineBtn: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#ff4444', justifyContent: 'center', alignItems: 'center', zIndex: 10, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4 },

  canvasHeader: { position: 'absolute', top: 40, width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, zIndex: 10 },
  hamburgerBtn: { padding: 10 },
  pillToolbar: { flexDirection: 'row', alignItems: 'center', borderRadius: 40, paddingHorizontal: 15, paddingVertical: 10, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10 },
  divider: { width: 1, height: 24, backgroundColor: '#444', marginHorizontal: 8 },
  iconBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  sizeBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginHorizontal: 2 },
  headerRight: { flexDirection: 'row', gap: 10 },
  actionBtnSecondary: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, borderWidth: 1 },
  actionBtnPrimary: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: '#007AFF', borderRadius: 8 },
  btnTextPrimary: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  canvas: { flex: 1, touchAction: 'none' },
  textWrapper: { position: 'absolute', backgroundColor: 'transparent', borderRadius: 4, borderWidth: 1 },
  canvasInput: { flex: 1, fontSize: 18, padding: 8, outlineStyle: 'none' },
  moveHandle: { position: 'absolute', top: -20, left: '50%', transform: [{translateX: -16}], width: 32, height: 20, backgroundColor: '#007AFF', borderTopLeftRadius: 6, borderTopRightRadius: 6, alignItems: 'center', justifyContent: 'center', cursor: 'move', zIndex: 10 },
  moveHandleIcon: { color: '#fff', fontSize: 14, marginTop: -2 },
  resizeHandle: { position: 'absolute', bottom: -5, right: -5, width: 12, height: 12, backgroundColor: '#007AFF', cursor: 'nwse-resize', borderRadius: 6, borderWidth: 2, borderColor: '#121212' },
  deleteTextBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: '#ff4444', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', zIndex: 5, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3 },
  draftingBox: { position: 'absolute', borderWidth: 2, borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.05)' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: 320, padding: 25, borderRadius: 16, borderWidth: 1 },
  modalTitle: { fontSize: 20, marginBottom: 20, fontWeight: '700', textAlign: 'center' },
  input: { padding: 15, borderRadius: 10, marginBottom: 25, fontSize: 16, borderWidth: 1 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  modalBtn: { padding: 14, borderRadius: 10, width: '48%', alignItems: 'center' },

  colorPickerContent: { width: 320, padding: 25, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15 },
  largeColorDot: { width: 45, height: 45, borderRadius: 22.5, borderWidth: 3 },

  sideMenuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row' },
  sideMenuContent: { width: 280, height: '100%', padding: 25, paddingTop: 60, borderRightWidth: 1, shadowColor: '#000', shadowOffset: {width: 5, height: 0}, shadowOpacity: 0.5, shadowRadius: 15 },
  sideMenuTitle: { fontSize: 26, fontWeight: 'bold', marginBottom: 40 },
  sectionTitle: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1.5 },
  menuOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  menuOptionCheck: { color: '#007AFF', fontSize: 18, fontWeight: '900' },
  
  addTagContainer: { flexDirection: 'row', marginBottom: 15 },
  addTagInput: { flex: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  addTagBtn: { marginLeft: 8, backgroundColor: '#007AFF', width: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  addTagBtnText: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: -2 },
  tagItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  tagDot: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },

  chatOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'flex-end', padding: 20 },
  chatContainer: { width: 350, height: 500, borderRadius: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: {width: 0, height: 5}, shadowOpacity: 0.5, shadowRadius: 15, overflow: 'hidden' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
  chatTitle: { fontSize: 18, fontWeight: 'bold' },
  chatScroll: { flex: 1 },
  chatBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginVertical: 5 },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  neuriBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  chatInputContainer: { flexDirection: 'row', padding: 10, borderTopWidth: 1 },
  chatInput: { flex: 1, borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8, borderWidth: 1, marginRight: 10 },
  chatSendBtn: { backgroundColor: '#007AFF', borderRadius: 20, paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center' }
});