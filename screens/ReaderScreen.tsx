import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import COLORS from '../theme/colors';
import type { LibraryStackParamList } from '../navigation/LibraryStack';

type Props = NativeStackScreenProps<LibraryStackParamList, 'Reader'>;
type PositionMessage = { type: 'position'; currentPage: number; totalPages: number; position: string };
type ReaderMessage = { type: 'ready' } | PositionMessage | { type: 'highlight'; page: number; anchor: string; quote: string; format: string };
type Bookmark = { bookId: number; position: string; currentPage: number; label: string; createdAt: string };
type ReaderHighlight = { id: number; bookId: number; format: string; page: number; anchor: string; quote: string; createdAt: string };

function getReaderHtml(runtime: string, worker: string) {
  const workerSource = JSON.stringify(worker);
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>
  *{box-sizing:border-box}body{margin:0;background:#f4efe2;color:#173f35;font:17px Georgia,serif}#reader{height:calc(100dvh - 52px);overflow:auto;padding:18px;touch-action:pan-x pan-y}#status{position:fixed;inset:0;display:grid;place-items:center;background:#f4efe2;color:#68786e;font:15px Arial,sans-serif}#pdf-page-wrap{position:relative;margin:24px auto;box-shadow:0 5px 24px #173f3526;background:#fff}#pdf-page{display:block}#pdf-text-layer{position:absolute;inset:0;overflow:hidden;line-height:1;user-select:text;-webkit-user-select:text}#pdf-text-layer span,#pdf-text-layer br{position:absolute;color:transparent;white-space:pre;cursor:text;transform-origin:0 0}#pdf-highlights{position:absolute;inset:0;pointer-events:none}.pdf-highlight{position:absolute;background:#e8c65b88;border-radius:2px;mix-blend-mode:multiply}#epub{height:100%;width:100%}#error{padding:28px;color:#173f35;font:16px Arial,sans-serif;line-height:1.5}#controls{height:52px;display:flex;gap:8px;align-items:center;justify-content:center;background:#173f35;color:#fffcf5;font:14px Arial,sans-serif}button{background:#d8c18b;border:0;border-radius:7px;color:#173f35;min-width:40px;height:36px;padding:7px 10px;font-weight:bold;display:inline-flex;align-items:center;justify-content:center}button svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}#count{min-width:72px;text-align:center}.epubjs-hl{fill:#e8c65b;fill-opacity:.45;mix-blend-mode:multiply}
  </style></head><body><div id="status">Preparando seu livro…</div><div id="reader"></div><script>${runtime}</script><script>
  const workerSource=${workerSource};
  let pdf=null, pageNumber=1, rendition=null, saveTimer=null, pdfZoom=1, epubFontSize=100, activePdfRender=null, savedHighlights=[], lastEpubSelection=null;
  const send=(message)=>window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(message));
  const showError=(message)=>{document.getElementById('status').style.display='none';document.getElementById('reader').innerHTML='<div id="error">'+message+'</div>';};
  const savePosition=(position,total)=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>send({type:'position',currentPage:pageNumber,totalPages:total,position}),300);};
  const readLocalFile=(uri)=>new Promise((resolve,reject)=>{const request=new XMLHttpRequest();request.open('GET',uri,true);request.responseType='arraybuffer';request.onload=()=>request.status===0||request.status<400?resolve(request.response):reject(new Error('Arquivo inacessível'));request.onerror=()=>reject(new Error('Arquivo inacessível'));request.send();});
  async function renderPdf(uri,position){
    const workerUrl=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
    BentoraReader.pdfjsLib.GlobalWorkerOptions.workerPort=new Worker(workerUrl,{type:'module'});
    const bytes=await readLocalFile(uri);
    pdf=await BentoraReader.pdfjsLib.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;
    pageNumber=Math.min(Math.max(Number(position)||1,1),pdf.numPages);
    document.getElementById('status').style.display='none';
    const controls=document.createElement('div');controls.id='controls';
    controls.innerHTML='<button id="prev" aria-label="Página anterior"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button><button id="zoom-out" aria-label="Diminuir zoom"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5M8 11h6"/></svg></button><span id="count"></span><button id="zoom-in" aria-label="Aumentar zoom"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5M8 11h6m-3-3v6"/></svg></button><button id="next" aria-label="Próxima página"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>';
    document.body.insertBefore(controls,document.getElementById('reader'));
    document.getElementById('prev').onclick=()=>showPage(pageNumber-1);
    document.getElementById('next').onclick=()=>showPage(pageNumber+1);
    document.getElementById('zoom-out').onclick=()=>changePdfZoom(-0.2);
    document.getElementById('zoom-in').onclick=()=>changePdfZoom(0.2);
    document.getElementById('reader').addEventListener('click',event=>{
      if(event.target.closest('button'))return;
      const ratio=event.clientX/window.innerWidth;
      if(ratio<0.25)showPage(pageNumber-1);else if(ratio>0.75)showPage(pageNumber+1);
    });
    attachPdfPinch();
    await showPage(pageNumber);
  }
  function changePdfZoom(amount){const reader=document.getElementById('reader'),wrap=document.getElementById('pdf-page-wrap');if(!wrap)return;const rect=wrap.getBoundingClientRect(),anchor={x:(reader.clientWidth/2-rect.left)/rect.width,y:(reader.clientHeight/2-rect.top)/rect.height};pdfZoom=Math.max(.7,Math.min(3,Math.round((pdfZoom+amount)*10)/10));showPage(pageNumber,{anchor,center:true});}
  function attachPdfPinch(){let startDistance=0,lastChange=0;const reader=document.getElementById('reader');reader.addEventListener('touchstart',event=>{if(event.touches.length===2)startDistance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);},{passive:true});reader.addEventListener('touchmove',event=>{if(event.touches.length!==2||!startDistance)return;event.preventDefault();const distance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);if(Math.abs(distance-startDistance)>30&&Date.now()-lastChange>100){const x=(event.touches[0].clientX+event.touches[1].clientX)/2,y=(event.touches[0].clientY+event.touches[1].clientY)/2,rect=document.getElementById('pdf-page-wrap').getBoundingClientRect();pdfZoom=Math.max(.7,Math.min(3,Math.round((pdfZoom+(distance>startDistance?.15:-.15))*10)/10));showPage(pageNumber,{anchor:{x:(x-rect.left)/rect.width,y:(y-rect.top)/rect.height},point:{x,y}});startDistance=distance;lastChange=Date.now();}},{passive:false});reader.addEventListener('touchend',()=>{startDistance=0;},{passive:true});}
  function addPdfHighlight(anchor){const wrap=document.getElementById('pdf-page-wrap'),layer=document.getElementById('pdf-highlights');if(!wrap||!layer)return;JSON.parse(anchor).forEach(r=>{const mark=document.createElement('div');mark.className='pdf-highlight';mark.style.cssText='left:'+r.x*wrap.clientWidth+'px;top:'+r.y*wrap.clientHeight+'px;width:'+r.width*wrap.clientWidth+'px;height:'+r.height*wrap.clientHeight+'px';layer.appendChild(mark);});}
  async function showPage(number,options={}){if(number<1||number>pdf.numPages)return;const oldPage=pageNumber;pageNumber=number;if(activePdfRender)activePdfRender.cancel();const page=await pdf.getPage(number),reader=document.getElementById('reader'),ratio=Math.min(window.devicePixelRatio||1,2),scale=(reader.clientWidth-36)/page.getViewport({scale:1}).width*pdfZoom,cssViewport=page.getViewport({scale}),viewport=page.getViewport({scale:scale*ratio}),wrap=document.createElement('div');wrap.id='pdf-page-wrap';wrap.style.width=cssViewport.width+'px';wrap.style.height=cssViewport.height+'px';const canvas=document.createElement('canvas');canvas.id='pdf-page';canvas.width=viewport.width;canvas.height=viewport.height;canvas.style.width=cssViewport.width+'px';canvas.style.height=cssViewport.height+'px';const textLayer=document.createElement('div');textLayer.id='pdf-text-layer';const marks=document.createElement('div');marks.id='pdf-highlights';wrap.append(canvas,textLayer,marks);reader.replaceChildren(wrap);const task=page.render({canvasContext:canvas.getContext('2d'),viewport});activePdfRender=task;try{await task.promise;}catch(error){if(error.name==='RenderingCancelledException')return;throw error;}finally{if(activePdfRender===task)activePdfRender=null;}try{const text=await page.getTextContent();await new BentoraReader.pdfjsLib.TextLayer({textContentSource:text,container:textLayer,viewport:cssViewport}).render();}catch(error){console.warn('PDF text layer unavailable',error);}savedHighlights.filter(h=>h.format==='pdf'&&h.page===number).forEach(h=>addPdfHighlight(h.anchor));if(options.center&&options.anchor){reader.scrollLeft=Math.max(0,options.anchor.x*wrap.offsetWidth-reader.clientWidth/2);reader.scrollTop=Math.max(0,options.anchor.y*wrap.offsetHeight-reader.clientHeight/2);}else if(options.point&&options.anchor){reader.scrollLeft=Math.max(0,options.anchor.x*wrap.offsetWidth-(options.point.x-reader.getBoundingClientRect().left));reader.scrollTop=Math.max(0,options.anchor.y*wrap.offsetHeight-(options.point.y-reader.getBoundingClientRect().top));}else if(oldPage!==number){reader.scrollTop=0;reader.scrollLeft=0;}document.getElementById('count').textContent=number+' / '+pdf.numPages+' · '+Math.round(pdfZoom*100)+'%';savePosition(String(number),pdf.numPages);}  async function renderEpub(uri,position){
    const bytes=await readLocalFile(uri);
    const book=BentoraReader.ePub(bytes);await book.ready;
    const spineItems=book.spine.items;const current=Number(position)||1;
    rendition=book.renderTo('reader',{width:'100%',height:'100%',flow:'paginated',spread:'none'});
    rendition.on('relocated',location=>{const index=(location.start&&location.start.index||0)+1;pageNumber=index;document.getElementById('count').textContent='Capítulo '+index+' / '+spineItems.length;savePosition(location.start&&location.start.cfi||String(index),spineItems.length);});
    rendition.on('rendered',(section,view)=>attachEpubGestures(view));rendition.on('selected',(cfi,contents)=>{const quote=contents&&contents.window.getSelection().toString().trim();if(quote)lastEpubSelection={cfi,quote};});
    document.getElementById('status').style.display='none';
    const controls=document.createElement('div');controls.id='controls';
    controls.innerHTML='<button id="prev" aria-label="Página anterior"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button><button id="zoom-out" aria-label="Diminuir zoom"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5M8 11h6"/></svg></button><span id="count"></span><button id="zoom-in" aria-label="Aumentar zoom"><svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5M8 11h6m-3-3v6"/></svg></button><button id="next" aria-label="Próxima página"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>';
    document.body.insertBefore(controls,document.getElementById('reader'));
    document.getElementById('prev').onclick=()=>rendition.prev();
    document.getElementById('next').onclick=()=>rendition.next();
    document.getElementById('zoom-out').onclick=()=>changeEpubZoom(-10);
    document.getElementById('zoom-in').onclick=()=>changeEpubZoom(10);
    await rendition.display(current>1&&spineItems[current-1]?spineItems[current-1].href:undefined);
    if(position&&String(position).startsWith('epubcfi('))await rendition.display(position);
    savedHighlights.filter(h=>h.format==='epub').forEach(h=>rendition.annotations.add('highlight',h.anchor,{},undefined,'bentora-saved-highlight',{fill:'#e8c65b','fill-opacity':'0.45','mix-blend-mode':'multiply'}));
  }
  function changeEpubZoom(amount){epubFontSize=Math.max(70,Math.min(200,epubFontSize+amount));rendition.themes.fontSize(epubFontSize+'%');document.getElementById('count').textContent='Capítulo '+pageNumber+' · '+epubFontSize+'%';}
  function attachEpubGestures(view){const contents=view&&view.contents;if(!contents||!contents.document)return;const doc=contents.document;doc.addEventListener('click',event=>{if(event.target.closest('a'))return;const ratio=event.clientX/contents.window.innerWidth;if(ratio<0.25)rendition.prev();else if(ratio>0.75)rendition.next();});let startDistance=0;doc.addEventListener('touchstart',event=>{if(event.touches.length===2)startDistance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);},{passive:true});doc.addEventListener('touchmove',event=>{if(event.touches.length!==2||!startDistance)return;event.preventDefault();const distance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);if(Math.abs(distance-startDistance)>24){changeEpubZoom(distance>startDistance?10:-10);startDistance=distance;}},{passive:false});doc.addEventListener('touchend',()=>{startDistance=0;},{passive:true});}
  window.markSelection=()=>{if(pdf){const selection=window.getSelection(),wrap=document.getElementById('pdf-page-wrap');if(!selection||selection.isCollapsed||!wrap)return false;const quote=selection.toString().trim(),bounds=wrap.getBoundingClientRect();if(!quote)return false;const rects=Array.from(selection.getRangeAt(0).getClientRects()).map(r=>({x:(r.left-bounds.left)/bounds.width,y:(r.top-bounds.top)/bounds.height,width:r.width/bounds.width,height:r.height/bounds.height})).filter(r=>r.width>0&&r.height>0);if(!rects.length)return false;const anchor=JSON.stringify(rects);addPdfHighlight(anchor);send({type:'highlight',format:'pdf',page:pageNumber,anchor,quote});selection.removeAllRanges();return true;}if(lastEpubSelection){const h=lastEpubSelection;rendition.annotations.add('highlight',h.cfi,{},undefined,'bentora-saved-highlight',{fill:'#e8c65b','fill-opacity':'0.45','mix-blend-mode':'multiply'});send({type:'highlight',format:'epub',page:pageNumber,anchor:h.cfi,quote:h.quote});lastEpubSelection=null;return true;}return false;};  window.goToReaderPosition=position=>{if(pdf)showPage(Number(position));else if(rendition)rendition.display(position);};
  window.startBentoraReader=async({uri,format,position,highlights=[]})=>{savedHighlights=highlights;try{if(format==='pdf')await renderPdf(uri,position);else await renderEpub(uri,position);}catch(error){console.error(error);showError('Não foi possível abrir este arquivo. Verifique se ele é um PDF ou EPUB válido e sem proteção por senha.');}};
  send({type:'ready'});
  </script></body></html>`;
}

export default function ReaderScreen({ route, navigation }: Props) {
  const { id, title, fileUri, fileType, readerPosition } = route.params;
  const db = useSQLiteContext();
  const webViewRef = useRef<WebView<{}>>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPosition = useRef<PositionMessage | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [bookmarksVisible, setBookmarksVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    const prepare = async () => {
      try {
        const [runtimeAsset, workerAsset] = await Promise.all([
          Asset.fromModule(require('../assets/reader/reader-runtime.html')).downloadAsync(),
          Asset.fromModule(require('../assets/reader/pdf-worker.html')).downloadAsync(),
        ]);
        if (!runtimeAsset.localUri || !workerAsset.localUri || !FileSystem.documentDirectory) {
          throw new Error('Não foi possível preparar o leitor local.');
        }
        const [runtime, worker] = await Promise.all([
          FileSystem.readAsStringAsync(runtimeAsset.localUri),
          FileSystem.readAsStringAsync(workerAsset.localUri),
        ]);
        const readerHtml = getReaderHtml(runtime, worker);
        const readerPath = `${FileSystem.documentDirectory}bentora-reader.html`;
        await FileSystem.writeAsStringAsync(readerPath, readerHtml);
        if (mounted) setHtml(readerPath);
      } catch (prepareError) {
        console.error(prepareError);
        if (mounted) setError(true);
      }
    };
    void prepare();
    return () => { mounted = false; };
  }, []);

  const savePosition = useCallback(async (position: PositionMessage) => {
    latestPosition.current = position;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await db.runAsync(
        `UPDATE books SET readerPosition = ?, currentPage = ?, totalPages = ?,
         status = CASE WHEN status = 'Concluído' THEN status ELSE 'Lendo' END,
         startedAt = CASE WHEN startedAt IS NULL THEN ? ELSE startedAt END WHERE id = ?`,
        position.position, position.currentPage, position.totalPages,
        new Date().toISOString(), id
      );
    }, 500);
  }, [db, id]);

  const loadBookmarks = useCallback(async () => {
    const result = await db.getAllAsync<Bookmark>(
      'SELECT bookId, position, currentPage, label, createdAt FROM readerBookmarks WHERE bookId = ? ORDER BY createdAt DESC',
      id
    );
    setBookmarks(result);
  }, [db, id]);

  const addBookmark = async () => {
    const current = latestPosition.current;
    if (!current) {
      Alert.alert('Leitor carregando', 'Aguarde a página aparecer para marcá-la.');
      return;
    }
    const label = `${fileType === 'pdf' ? 'Página' : 'Capítulo'} ${current.currentPage}`;
    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO readerBookmarks (bookId, position, currentPage, label, createdAt) VALUES (?, ?, ?, ?, ?)',
        id, current.position, current.currentPage, label, new Date().toISOString()
      );
      await loadBookmarks();
      Alert.alert('Marcador salvo', `${label} foi adicionado aos marcadores deste livro.`);
    } catch (bookmarkError) {
      console.error(bookmarkError);
      Alert.alert('Erro', 'Não foi possível salvar este marcador.');
    }
  };

  const openBookmark = (bookmark: Bookmark) => {
    webViewRef.current?.injectJavaScript(
      `window.goToReaderPosition(${JSON.stringify(bookmark.position)}); true;`
    );
    setBookmarksVisible(false);
  };

  const removeBookmark = async (bookmark: Bookmark) => {
    await db.runAsync(
      'DELETE FROM readerBookmarks WHERE bookId = ? AND position = ?',
      bookmark.bookId, bookmark.position
    );
    await loadBookmarks();
  };

  // A consulta SQLite é assíncrona; o estado é atualizado quando ela termina.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadBookmarks(); }, [loadBookmarks]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const position = latestPosition.current;
    if (position) {
      void db.runAsync(
        `UPDATE books SET readerPosition = ?, currentPage = ?, totalPages = ?,
         status = CASE WHEN status = 'Concluído' THEN status ELSE 'Lendo' END,
         startedAt = CASE WHEN startedAt IS NULL THEN ? ELSE startedAt END WHERE id = ?`,
        position.position, position.currentPage, position.totalPages,
        new Date().toISOString(), id
      );
    }
  }, [db, id]);

  const handleMessage = async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as ReaderMessage;
      if (message.type === 'ready') {
        const position = fileType === 'epub' && readerPosition?.startsWith('epubcfi(')
          ? readerPosition
          : String(readerPosition || route.params.currentPage || 1);
        const highlights = await db.getAllAsync<ReaderHighlight>(
          'SELECT id, bookId, format, page, anchor, quote, createdAt FROM readerHighlights WHERE bookId = ? ORDER BY createdAt', id
        );
        webViewRef.current?.injectJavaScript(
          `window.startBentoraReader(${JSON.stringify({ uri: fileUri, format: fileType, position, highlights })}); true;`
        );
      } else if (message.type === 'position') {
        void savePosition(message);
      } else if (message.type === 'highlight') {
        void db.runAsync(
          'INSERT INTO readerHighlights (bookId, format, page, anchor, quote) VALUES (?, ?, ?, ?, ?)',
          id, message.format, message.page, message.anchor, message.quote
        ).then(() => Alert.alert('Trecho destacado', 'A marcação foi salva neste livro.'))
          .catch((highlightError) => { console.error(highlightError); Alert.alert('Erro', 'Não foi possível salvar o destaque.'); });
      }
    } catch (parseError) {
      console.error(parseError);
    }
  };

  const source = useMemo(() => html ? { uri: html } : undefined, [html]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button">
            <Text style={styles.back}>‹ Biblioteca</Text>
          </TouchableOpacity>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          <Text style={styles.format}>{fileType.toUpperCase()}</Text>
        </View>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.headerButton} onPress={() => webViewRef.current?.injectJavaScript('window.markSelection(); true;')} accessibilityRole="button">
            <Text style={styles.headerButtonText}>Destacar seleção</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => void addBookmark()} accessibilityRole="button">
            <Text style={styles.headerButtonText}>Marcar página</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={() => setBookmarksVisible(true)} accessibilityRole="button">
            <Text style={styles.headerButtonText}>Marcadores ({bookmarks.length})</Text>
          </TouchableOpacity>
        </View>
      </View>
      {error ? (
        <View style={styles.message}><Text style={styles.messageText}>Não foi possível preparar o leitor. Reabra o livro e tente novamente.</Text></View>
      ) : source ? (
        <WebView<{}>
          ref={webViewRef}
          source={source}
          originWhitelist={['*']}
          allowingReadAccessToURL={FileSystem.documentDirectory ?? undefined}
          allowFileAccess
          allowFileAccessFromFileURLs
          javaScriptEnabled
          onMessage={handleMessage}
          onError={() => Alert.alert('Erro de leitura', 'Não foi possível abrir o arquivo selecionado.')}
          style={styles.webview}
        />
      ) : (
        <View style={styles.message}><ActivityIndicator color={COLORS.gold} /><Text style={styles.messageText}>Preparando seu livro…</Text></View>
      )}
      <Modal visible={bookmarksVisible} transparent animationType="slide" onRequestClose={() => setBookmarksVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeading}>
              <Text style={styles.modalTitle}>Marcadores</Text>
              <TouchableOpacity onPress={() => setBookmarksVisible(false)}><Text style={styles.closeButton}>Fechar</Text></TouchableOpacity>
            </View>
            {bookmarks.length === 0 ? (
              <Text style={styles.emptyText}>As páginas marcadas neste livro aparecerão aqui.</Text>
            ) : (
              <ScrollView style={styles.bookmarkList}>
                {bookmarks.map((bookmark) => (
                  <View key={bookmark.position} style={styles.bookmarkRow}>
                    <TouchableOpacity style={styles.bookmarkOpen} onPress={() => openBookmark(bookmark)}>
                      <Text style={styles.bookmarkLabel}>{bookmark.label}</Text>
                      <Text style={styles.bookmarkDate}>{new Date(bookmark.createdAt).toLocaleDateString()}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => void removeBookmark(bookmark)} accessibilityLabel={`Excluir ${bookmark.label}`}>
                      <Text style={styles.removeBookmark}>Excluir</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: { gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.background },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  headerButton: { borderWidth: 1, borderColor: COLORS.gold, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  headerButtonText: { color: COLORS.gold, fontSize: 12, fontWeight: '600' },
  back: { color: COLORS.gold, fontSize: 15, fontWeight: '600' },
  title: { color: COLORS.surface, flex: 1, fontSize: 15, fontWeight: '600' },
  format: { color: COLORS.gold, fontSize: 11, fontWeight: '700' },
  webview: { flex: 1, backgroundColor: COLORS.cream },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  messageText: { color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  modalCard: { maxHeight: '70%', minHeight: 220, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: COLORS.cream },
  modalHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
  closeButton: { color: COLORS.background, fontWeight: '600', padding: 8 },
  bookmarkList: { flexGrow: 0 },
  bookmarkRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 12 },
  bookmarkOpen: { flex: 1 },
  bookmarkLabel: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  bookmarkDate: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  removeBookmark: { color: COLORS.danger, padding: 8, fontWeight: '600' },
  emptyText: { color: COLORS.textSecondary, lineHeight: 22, marginTop: 10 },
});
