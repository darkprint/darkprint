# DarkPrint — Documento di design

> Stato: design consolidato da una sessione di ragionamento. Alcune scelte sono **decise**, altre sono **raccomandazioni da confermare** (segnalate come tali). Documento pensato come input per l'implementazione.

---

## 0. Cos'è DarkPrint

`darkprint.io` — piattaforma dove sviluppatori e ricercatori caricano, valutano, condividono e **prelevano per eseguire** blueprint di *dark factory*: grafi che descrivono pipeline di agenti AI autonomi che coprono le cinque fasi planning, implementation, testing, debugging, deployment.

Target primario: sviluppatori e ricercatori tecnici nel mondo degli agenti AI.

Le tre superfici del sito:

| Sezione | Contenuto | Primitiva |
|---|---|---|
| **Blueprints** (ex "Gallery") | Blueprint completi (grafi) | grafo |
| **Nodes** (ex "Parts") | Card dei nodi riutilizzabili | nodo |
| **Ontology** | Vocabolario controllato | semantica |

### 0.1 Vincoli fondativi

Quattro decisioni che condizionano tutto il resto del documento. Vanno lette prima di qualsiasi altra sezione.

**1. Il formato è compatibile con Attractor.** Il DOT prodotto e consumato da DarkPrint deve restare leggibile dal tooling Attractor esistente. Questo vincola le scelte del §2: se un costrutto non è esprimibile in DOT compatibile, non si usa. Verificare la specifica Attractor **prima** di finalizzare lo schema.

**2. Le card portano le specifiche che istruiscono l'agente.** Il grafo istanziato non viene interpretato da un runtime proprietario di DarkPrint. Ogni nodo porta con sé la specifica in linguaggio naturale che **istruisce Claude Code, o un agente equivalente**, su cosa fare. Il blueprint è materiale di istruzione strutturato, non bytecode. Conseguenza diretta sullo schema della card: vedi §3.2.

**3. L'esecuzione è a carico dell'utente, sulla sua macchina.** DarkPrint **non esegue codice agentico lato server**. Non c'è sandbox, non ci sono chiavi API di terzi in custodia, non c'è costo di esecuzione a carico della piattaforma. Il sito distribuisce, analizza staticamente e raccoglie telemetria opt-in. Vedi §9.2 e la nota in §8 sulle metriche riportate.

**4. DarkPrint è slegato da GitHub.** Nessun OAuth GitHub, nessun collegamento di repository utente, nessun uso di Git come archivio dei blueprint. Vedi §5.1.

> ⚠️ Il vincolo 4 riguarda **il prodotto**, non il flusso di sviluppo dell'autore. Il repo di DarkPrint stesso può stare su GitHub e usare GitHub Actions per la CI (§9.1). Sono due piani distinti e non vanno confusi.

---

## 1. Struttura concettuale: due primitive, non tre

**Decisione:** il sito ha **due primitive strutturali** — il **nodo** (card singola) e il **blueprint** (grafo completo).

La sezione "parts" intesa come *sottografi riutilizzabili* viene **rimandata**, non implementata ora:

- Nodo e blueprint sono primitive nette e non ambigue; il sottografo è una via di mezzo che introduce un terzo livello con confini arbitrari ("quando un pezzo smette di essere un nodo e diventa un sottografo?").
- Un sottografo è, in fondo, **solo un blueprint più piccolo**. Quando il bisogno emergerà (pattern ricorrenti tipo retry o negoziazione tra agenti, che raramente sono un nodo solo), lo si risolve permettendo di **importare un blueprint dentro un altro** — non con una terza sezione.

**Implicazione implementativa:** progettare il modello dati del blueprint in modo che sia già *componibile* (un blueprint può referenziare un altro blueprint come nodo composito), anche se l'UI non lo espone subito.

L'**ontologia** resta invece una sezione a sé: non è una primitiva strutturale, è il **vocabolario** che dà significato alle altre due.

---

## 2. Modello dati: topologia e dettaglio separati

**Decisione centrale.** Il DOT porta **solo la topologia**; il dettaglio ricco vive in **card esterne**.

```
blueprint.dot          →  nodi + archi, identificatori, niente altro
cards/<id>@<ver>.yaml  →  la definizione completa di ogni nodo
```

Ogni nodo nel DOT ha un **identificatore univoco** che fa da puntatore alla card che lo istanzia.

### Perché

- Il grafo resta leggibile e disegnabile con gli strumenti classici del DOT (Graphviz e affini).
- Gli attributi DOT sono **tutte stringhe piatte**: una configurazione annidata andrebbe serializzata a mano e ri-parsata. YAML/JSON no.
- Le card si versionano, riusano e validano **separatamente** dal grafo.
- La stessa card è referenziabile da blueprint diversi **senza duplicazione**.

### Ruolo degli archi

Gli archi rappresentano le **interfacce**: un arco da A a B dice che l'output di A diventa l'input di B. Sull'arco si può annotare il tipo di dato che transita.

### Vincolo da presidiare: integrità referenziale

Serve un validatore che verifichi, a ogni upload:

1. ogni identificatore presente nel DOT ha la sua card;
2. non esistono card orfane nel bundle;
3. i tipi dichiarati negli input/output sono coerenti lungo ogni arco;
4. tutti i valori di campi strutturali esistono nell'ontologia dichiarata (vedi §6).

---

## 3. Anatomia della card nodo

**Formato:** YAML (o JSON). YAML se si vuole che sia leggibile e scrivibile a mano; JSON se prevale il consumo programmatico. Il modello è identico.

Quattro blocchi:

### 3.1 Identità
- `id` — identificatore univoco, **è la chiave che lega la card al nodo nel DOT**
- `name` — nome leggibile
- `type` — tipo di nodo → **riferimento all'ontologia** (agente, strumento, controllo umano, decisione, validazione, …)

### 3.2 Comportamento
- `action` — l'operazione che il nodo esegue, in forma breve e machine-readable
- `spec` — **la specifica in linguaggio naturale che istruisce l'agente**. È il payload che viene consegnato a Claude Code (o equivalente) quando il grafo viene istanziato. Vedi sotto.
- `model` / `agent` — chi la esegue
- `tools[]` — strumenti richiesti (alimenta anche la scheda tecnica del blueprint)
- `params` — parametri di configurazione (annidati)

Il campo `spec` è il cuore esecutivo della card e discende dal vincolo §0.1.2. Regole:

- Deve essere **autosufficiente**: l'agente che lo riceve non vede il resto del grafo, quindi la spec deve contenere tutto ciò che serve a svolgere quel compito, e nient'altro.
- Deve rispettare **le regole di isolamento del grafo**. Se un nodo non deve vedere certe informazioni (il caso canonico: il nodo di implementazione non vede i criteri di accettazione), quelle informazioni non compaiono nella sua `spec`. **L'isolamento non è solo assenza di un arco, è assenza del contenuto nella spec.** Un arco mancante nel DOT con la spec che rivela comunque i criteri è un falso isolamento, e l'analisi statica non se ne accorgerebbe.
- Va tenuta **separata** dai metadati analizzabili (§3.4). La spec è prosa per un agente; i metadati sono strutturati per DarkPrint.

### 3.3 Interfacce
- `inputs[]` — input attesi, con tipo/formato
- `outputs[]` — output prodotti, con tipo/formato
- `dependencies[]` — da quali altri nodi riceve dati (rende esplicito il collegamento)

### 3.4 Metadati di valutazione
- `requires_human` — flag per la metrica **autonomia**
- `risk_markers[]` — marcatori per la metrica **sicurezza** → **riferimenti all'ontologia**
- `notes` — note tecniche libere

### 3.5 Campi di servizio
- `version` — versione semantica della card (§4)
- `author` / `provenance` — chi l'ha scritta, da dove viene
- `ontology_version` — contro quale versione del vocabolario è scritta

> **La struttura è a due facce:** identità, comportamento e interfacce servono all'**esecuzione**, e in particolare `spec` è ciò che l'agente legge davvero; i metadati di valutazione servono all'**analisi statica** di DarkPrint. Lo stesso file alimenta entrambi i mondi, ma i due mondi non leggono gli stessi campi.

Una collezione di queste card è di fatto la **libreria di nodi riutilizzabili** del sito.

---

## 4. Versionamento delle card

**Principio invariante: una card pubblicata non si modifica mai sul posto.** Se cambia, nasce una nuova versione. Motivo: un blueprint che punta a quella card si aspetta un comportamento preciso; cambiarlo sotto i piedi invalida le valutazioni già raccolte.

### Versionamento semantico (`MAJOR.MINOR.PATCH`)

| Componente | Quando incrementa |
|---|---|
| **MAJOR** | modifica che rompe la compatibilità (cambio di `inputs`/`outputs`) |
| **MINOR** | aggiunta retrocompatibile (nuovo strumento opzionale) |
| **PATCH** | correzione minore (nota, parametro di default) |

### Come il DOT referenzia la card — **decisione: pinnare la versione esatta**

Due modi possibili:

- `id` + versione esatta → blueprint **congelato e riproducibile al 100%**
- solo `id`, si prende l'ultima compatibile → più comodo, meno prevedibile

**Per DarkPrint si pinna la versione esatta.** Le metriche devono essere ripetibili e confrontabili: quando due utenti votano efficacia o affidabilità, devono aver valutato **esattamente lo stesso nodo**.

### Identificazione per hash del contenuto

**Decisione.** Ogni versione di card è identificata anche da un **hash del suo contenuto**. Conseguenze desiderate:

- l'identificatore stesso **garantisce** che il contenuto non sia cambiato;
- due card identiche **collassano naturalmente sullo stesso hash** (deduplicazione gratuita);
- riproducibilità verificabile: un blueprint riesegue esattamente ciò che ha valutato.

Lo storico delle versioni è **immutabile**: una card vecchia resta sempre recuperabile.

---

## 5. Persistenza: archivio immutabile + indice interrogabile

Le due filosofie si combinano.

### 5.1 Archivio del contenuto (immutabile)

**Decisione: object storage, non Git.** DarkPrint è deliberatamente **slegato da GitHub** (§0.1). Ogni versione di card e di blueprint è un oggetto la cui chiave è l'**hash del contenuto** (§4).

L'hash garantisce da solo tutte le proprietà che servivano: immutabilità (cambiare il contenuto significa cambiare la chiave, quindi il vecchio oggetto resta intatto), deduplicazione (due card identiche collassano sulla stessa chiave), verificabilità (chi scarica può ricalcolare l'hash e confermare che è ciò che il sito dichiara).

Il diff tra versioni, che sarebbe stato il vantaggio di Git, si calcola a runtime su due oggetti di testo. Non serve un DVCS per ottenerlo.

> Git resta possibile come **funzione di export** in un secondo momento (l'utente esporta la propria libreria come repo), ma non è l'archivio del sito, e nulla nell'architettura deve dipenderne.

### 5.2 Indice (database)
Serve comunque all'app. Contiene **puntatori** alle versioni archiviate, più tutto ciò che va interrogato in fretta:

- quale card, quale versione, quale autore
- reputazione di autori e validatori
- quali blueprint usano quale card
- tag, categorie, filtri di ricerca
- le sei metriche di valutazione e i voti della community
- telemetria opt-in (costo/tempo di esecuzione)

> Regola pratica: **il contenuto immutabile vive nell'object storage indicizzato per hash, i metadati di ricerca nel database.** Non mescolare: un database non garantisce l'immutabilità senza lavoro extra, e un object storage non si interroga.

---

## 6. Ontologia — il vocabolario controllato

L'ontologia è **il contratto**; le card sono le **istanze** che lo rispettano.

### 6.1 Aggancio alle card

Ogni volta che una card scrive un valore in un **campo strutturale** (`type`, categoria, `risk_markers`), quel valore **non è testo libero**: è un riferimento a una voce dell'ontologia. L'ontologia definisce quali voci esistono, cosa significano, e che **relazioni** hanno tra loro (es. "validazione" è un caso particolare di "controllo").

Tre vantaggi:

1. **Coerenza** — due utenti non chiamano la stessa cosa in due modi diversi; metriche e ricerche funzionano davvero.
2. **Analisi statica più potente** — si può ragionare sui tipi in modo semantico ("questo marcatore è una sottocategoria di accesso esterno").
3. **Evoluzione centralizzata** — il vocabolario cresce senza toccare le singole card.

### 6.2 Evoluzione senza rotture

Stesso problema del versionamento delle card, ma con posta più alta: l'ontologia sta sotto a tutto.

**Principio: aggiungere è sicuro, cambiare o togliere è pericoloso.**

- ✅ **Aggiungere** un tipo o un marcatore → non rompe nulla, le card vecchie semplicemente non lo usano. Libero.
- ⚠️ **Rinominare** (es. "controllo umano" → "intervento umano") → tutte le card che puntavano al vecchio nome diventano orfane.
- ⚠️ **Rimuovere o fondere** voci → stessi riferimenti rotti.

**Soluzione: non si cancella mai davvero.** Un rename è in realtà:

1. si crea la nuova voce;
2. si marca la vecchia come **deprecata** (resta valida per chi la usa);
3. si registra un **puntatore di equivalenza** tra le due;
4. il sito suggerisce la nuova per le card nuove.

L'ontologia stessa è **versionata**. Ogni card e ogni blueprint dichiara contro quale versione è scritto, così l'analisi statica sa sempre come interpretarlo. Le migrazioni sono esplicite e tracciate, mai silenziose.

---

## 7. Governance dell'ontologia — modello a livelli

L'ontologia è un bene comune; chi può modificarla è una scelta di design.

Opzioni valutate: (1) centralizzato — coerenza massima ma collo di bottiglia; (2) proposte con revisione; (3) **a livelli — raccomandato per DarkPrint**.

### Modello a livelli

- **Nucleo centrale** — curato, stabile, cambia di rado e con revisione seria.
- **Namespace locali** — ogni utente può definire tipi e marcatori propri (es. `berti/rischio-memoria-persistente`) senza sporcare il nucleo comune.
- **Promozione** — un'estensione locale che ricorre e si diffonde sale nel nucleo.

Risolve la tensione di fondo: **stabilità del bene comune** da una parte, **libertà di sperimentare** dall'altra. La reputazione è il meccanismo che fa salire le idee buone.

### Il processo di promozione, in quattro fasi

**1. Emersione.** La voce vive nel namespace dell'autore. Il sistema conta: quante card la usano, quanti **autori distinti** l'hanno adottata, in quanti blueprint compare.

**2. Segnalazione (automatica).** Superata una soglia — indicativamente *N autori distinti su M blueprint*, da tarare — la voce viene marcata **"candidata alla promozione"**. Non è ancora una decisione umana: è un segnale che il pattern è reale e non il capriccio di uno.

**3. Revisione.** Entrano i validatori ad alta reputazione. Valutano: è davvero distinta dalle voci esistenti o è un doppione? È definita bene? Come si aggancia al nucleo? Esito possibile anche la **fusione** con una voce esistente invece dell'aggiunta.

**4. Adozione.** La voce entra nel nucleo con la sua versione, e si crea un **puntatore di equivalenza** dal nome locale a quello canonico — le card esistenti non si rompono (stesso meccanismo di §6.2).

> Risultato: l'ontologia cresce **dal basso** ma resta curata. La community propone, i dati d'uso filtrano, i validatori sanciscono.

**Aperto:** tarare le soglie della fase 2 e definire come si guadagna la reputazione da validatore.

---

## 8. Le sei metriche di valutazione

| Metrica | Come si ottiene | Fiducia |
|---|---|---|
| **Autonomia** (1–4) | analisi statica del grafo | verificabile da chiunque |
| **Sicurezza** (1–4) | analisi statica del grafo | verificabile da chiunque |
| **Costo di esecuzione** | telemetria opt-in dalle esecuzioni degli utenti | **riportata** |
| **Tempo di esecuzione** | telemetria opt-in dalle esecuzioni degli utenti | **riportata** |
| **Efficacia** | voto della community | soggettiva |
| **Affidabilità** | voto della community | soggettiva |
| **Trasparenza** | voto della community | soggettiva |

> ⚠️ **Correzione rispetto alle prime bozze.** Dato che l'esecuzione avviene sulla macchina dell'utente (§0.1.3), costo e tempo **non sono misurati oggettivamente dalla piattaforma**: sono riportati da chi esegue. DarkPrint non può verificarli in modo indipendente.
>
> Conseguenze da implementare, non da nascondere:
> - la scheda del blueprint mostra il **numero di esecuzioni** e la **dispersione** dei valori, non solo la media. Un dato basato su due esecuzioni non vale come uno basato su duecento;
> - i valori anomali vanno filtrati, perché l'hardware, il modello scelto e la dimensione del task variano enormemente tra utenti;
> - accanto al valore va indicato **su quale modello** è stato ottenuto, altrimenti il confronto tra blueprint non significa nulla;
> - l'etichetta in interfaccia dice *riportato*, non *misurato*.

Le prime due metriche restano invece pienamente verificabili, perché si calcolano dal grafo senza eseguirlo: chiunque scarichi il bundle può rifare il conto e ottenere lo stesso risultato.

### 8.1 Autonomia — regola a frazione

> Applicare il principio del documento 2, §1.1: il punteggio è **descrittivo, non un voto**. Un blueprint con nodi umani non è un blueprint peggiore.

Deterministica, ripetibile, spiegabile.

```
1. Parsing del DOT → grafo in memoria (NetworkX o equivalente)
2. Per ogni nodo, risolvere la card e leggere `requires_human`
   (o il type ontologico "controllo umano" / "input manuale")
3. frazione_autonomi = nodi_senza_intervento / nodi_totali
4. Mappare la frazione su scala 1–4 a soglie
```

Esempio di mappatura (da tarare):

| Frazione | Punteggio |
|---|---|
| > 0.90 | 4 |
| 0.70 – 0.90 | 3 |
| 0.50 – 0.70 | 2 |
| < 0.50 | 1 |

*Esempio: 10 nodi, 2 richiedono intervento umano → 0.8 → punteggio 3.*

### 8.2 Sicurezza — regola a penalità pesate

Il ragionamento si **ribalta**: si parte da 4 e si sottrae. E **non conta la frazione, conta la gravità**: un solo nodo che esegue codice arbitrario può far crollare il punteggio anche se il resto del grafo è pulito.

Pattern da cercare (ciascuno con un **peso**):

1. **Esecuzione di codice arbitrario** (shell, `eval`) — peso alto
2. **Accesso a risorse esterne / rete** senza un nodo di validazione o filtro a monte
3. **Cicli senza condizione d'uscita chiara** — rischio di non terminazione
4. **Scrittura su disco o database** senza passaggio di controllo a monte

```
punteggio = 4 − Σ(penalità dei pattern trovati)  →  clamp su scala 1–4
```

**Aperto:** definire i pesi relativi dei quattro rischi.

### 8.3 Requisito trasversale: spiegabilità

Per entrambe le metriche statiche, il sistema deve **mostrare all'utente esattamente quali nodi** hanno determinato il punteggio (quali hanno abbassato l'autonomia, quali hanno fatto scattare l'allarme sicurezza). La valutazione non è un numero opaco.

Entrambe si ricavano **puramente dalla struttura del grafo, senza eseguirlo**.

---

## 9. Architettura di deployment

### 9.1 Front-end — Vercel

Ci va tutto ciò che è leggero e interattivo:

- pagine, galleria dei blueprint, libreria dei nodi, sezione ontologia
- autenticazione (username/password o magic link via email; **nessun OAuth GitHub**, §0.1.4) e profilo utente
- upload dei file
- visualizzazione delle schede di valutazione a sei metriche
- la vista sincronizzata a quattro riquadri del percorso guidato (documento 2, §5.1)

**Flusso di sviluppo dell'autore** (piano distinto dal prodotto, §0.1): repo su GitHub collegato a Vercel, ogni PR genera un **deploy di anteprima** con link dedicato, ispezionabile da browser o telefono. GitHub Actions con runner Scaleway per i test pre-deploy. Merge → produzione.

> Variabili d'ambiente e chiavi API si configurano nel pannello Vercel, **non** dentro la sandbox di Claude Code.

### 9.2 Backend

Le funzioni serverless hanno limiti di tempo e memoria. Serve un servizio con processi a lunga durata (Railway, Render o container) per:

- **analisi statica del grafo** (parsing DOT, calcolo autonomia e sicurezza)
- **istanziazione del bundle scaricabile** (DOT + card → artefatto eseguibile per l'utente)
- **indicizzazione per la semantic search** dell'MCP
- **ricezione della telemetria opt-in** inviata dalle esecuzioni degli utenti

> ⚠️ **Non compare "esecuzione dei blueprint".** Per il vincolo §0.1.3 l'esecuzione avviene sulla macchina dell'utente. Il backend non ospita sandbox agentiche, non custodisce chiavi API di terzi e non sostiene costi di inferenza. Questo elimina il pezzo di infrastruttura più costoso e più rischioso dell'intero progetto, ed è la ragione per cui la v1 è realizzabile come side project.

### 9.3 Dati — Supabase

**Decisione: Supabase copre auth, database e storage.** Non aggiungere un servizio separato per ciascuno.

| Ruolo | Componente |
|---|---|
| Autenticazione e profili | Supabase Auth |
| Indice interrogabile (§5.2) | Supabase Postgres |
| Archivio immutabile (§5.1) | Supabase Storage, chiavi = hash del contenuto |
| Semantic search per l'MCP | `pgvector` su Postgres |

Il front-end parla con tutto questo **via API**.

---

## 10. Ordine di implementazione

> **Sequenza unica per entrambi i documenti.** Vedi documento 2, §11. Le voci di questo documento sono i punti 0, 4, 5, 9, 12 e 13 di quella lista. Non esistono due ordini di implementazione: quello di riferimento è uno solo.

---

## 11. Questioni ancora aperte

- Taratura delle **soglie di autonomia** (§8.1) e dei **pesi di rischio** (§8.2)
- Soglie che fanno scattare la **candidatura alla promozione** (§7, fase 2)
- Come si **guadagna reputazione** da validatore
- YAML vs JSON per le card — dipende da quanto si vuole la scrittura a mano
- **Verificare la specifica Attractor** e confermare che lo schema del §2 e del §3 vi rientri (§0.1.1). Questo è un prerequisito, non una questione aperta rimandabile
- Layer di **traduzione via Claude Code** per utenti non tecnici (far girare blueprint senza vederne i dettagli interni)

> **Nota implementativa trasversale.** Tutte le soglie e i pesi ancora aperti (fasce di autonomia, pesi dei rischi, soglie di promozione, filtri sui dati di telemetria) vanno in **un unico file di configurazione**, non sparsi nel codice. Vanno tarati dopo il lancio con dati veri, e se sono disseminati nei sorgenti la taratura diventa una caccia al tesoro.
