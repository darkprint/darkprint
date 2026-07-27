# DarkPrint — Ontologia v0.1

> Il **vocabolario controllato** su cui poggiano card, metriche e ricerca. Terzo documento del pacchetto, insieme a `darkprint-design.md` (modello dati) e `darkprint-onboarding-positioning.md` (posizionamento e onboarding).
>
> **Questo file è il contratto.** Va implementato come dato, non come costanti sparse nel codice: un file di configurazione che il validatore e l'analisi statica leggono. Se cambia, cambia in un posto solo.
>
> Regola di evoluzione (doc 1 §6.2): **aggiungere è sicuro, rinominare e rimuovere no.** Non si cancella mai una voce, si deprecano con puntatore di equivalenza.

---

## 1. Le tre dimensioni

Ogni nodo dichiara **tre cose** indipendenti tra loro. Tenerle separate è importante: un nodo di implementazione può essere un agente o uno strumento deterministico, e sono nodi molto diversi pur stando nella stessa fase.

| Dimensione | Campo | Cardinalità | Alimenta |
|---|---|---|---|
| Fase | `phase` | esattamente 1 | copertura di fase, badge in galleria |
| Tipo di nodo | `type` | esattamente 1 | autonomia, leggibilità del grafo |
| Marcatori di rischio | `risk_markers[]` | 0..n | sicurezza |

---

## 2. `phase` — le cinque fasi

Chiuse. Sono la definizione stessa di dark factory e non si estendono nei namespace locali.

| Voce | Significato |
|---|---|
| `planning` | dalla richiesta al piano e ai criteri di accettazione |
| `implementation` | dal piano all'artefatto |
| `testing` | esecuzione delle verifiche e produzione delle evidenze |
| `debugging` | dalle evidenze di fallimento a una correzione mirata |
| `deployment` | rilascio, pubblicazione, consegna |

**Copertura di fase**: insieme delle fasi presenti in un blueprint. Si mostra come badge nella scheda. È **descrittiva, non un voto** (doc 2 §1.1): coprire tre fasi su cinque non è un difetto.

---

## 3. `type` — i tipi di nodo

| Voce | Significato | `requires_human` implicito |
|---|---|---|
| `agent` | un modello che ragiona e produce output non deterministico | no |
| `tool` | un'operazione deterministica: eseguire test, compilare, formattare, chiamare un'API | no |
| `human-gate` | un punto in cui una persona deve approvare o rifiutare | **sì** |
| `human-input` | un punto in cui una persona deve fornire dati o contenuti | **sì** |
| `decision` | uno smistamento condizionale, valuta e instrada senza produrre artefatti | no |
| `validation` | confronta un artefatto contro criteri e produce un verdetto con evidenze | no |

**Relazioni gerarchiche** (servono all'analisi statica per ragionare per categorie):

```
human-gate    ⊂ human-in-the-loop
human-input   ⊂ human-in-the-loop
validation    ⊂ evaluative
decision      ⊂ evaluative
```

`human-in-the-loop` è la categoria che l'analisi dell'autonomia interroga. Aggiungere in futuro un nuovo tipo umano lo fa rientrare automaticamente nel calcolo senza toccare il codice della metrica: è esattamente il motivo per cui l'ontologia esiste.

> **Nota per il validatore.** Se `type` è un sottotipo di `human-in-the-loop`, il campo `requires_human` della card **deve** essere `true`. Incoerenza tra i due è un errore di validazione, non un avviso.

---

## 4. `risk_markers` — i marcatori di rischio

I pesi indicati sono **valori di partenza da tarare**, e vivono nel file di configurazione, non qui.

| Voce | Significato | Peso iniziale |
|---|---|---|
| `arbitrary-code-execution` | il nodo può eseguire codice o comandi shell non predeterminati | 2.0 |
| `unvalidated-external-access` | accesso a rete, API o risorse esterne senza un nodo di validazione a monte | 1.0 |
| `unbounded-loop` | partecipa a un ciclo privo di tetto di iterazioni o condizione d'uscita | 1.5 |
| `unchecked-write` | scrive su disco, database o repository senza un passaggio di controllo a monte | 1.0 |
| `criteria-leak` | ha accesso ai criteri di accettazione contro cui il proprio output sarà giudicato | 2.0 |
| `secret-access` | maneggia credenziali, chiavi o token | 1.0 |
| `irreversible-action` | compie azioni non annullabili: pubblicazione, invio, cancellazione | 1.5 |

**Relazioni:**

```
arbitrary-code-execution ⊂ execution-risk
criteria-leak            ⊂ isolation-breach
unchecked-write          ⊂ isolation-breach
```

### 4.1 Marcatori inferiti dalla struttura

Tre marcatori **non si dichiarano nella card**: li deriva l'analisi statica dal grafo, e vanno calcolati anche se l'autore non li ha scritti.

- **`unbounded-loop`** — c'è un ciclo nel grafo e nessun nodo del ciclo dichiara un tetto di iterazioni.
- **`criteria-leak`** — esiste un cammino dal nodo che produce i criteri di accettazione al nodo che produce l'artefatto giudicato da quei criteri. Copre il caso in cui l'arco diretto è assente ma l'informazione arriva per vie traverse, che è precisamente l'errore che un autore in buona fede commette.
- **`unvalidated-external-access`** — un nodo con accesso esterno non ha un nodo `validation` fra sé e il consumatore del suo output.

> ⚠️ **`criteria-leak` va verificato anche sul contenuto della `spec`, non solo sulla topologia** (doc 1 §3.2). Un arco assente nel DOT con i criteri scritti dentro la spec del `builder` è un falso isolamento, e l'analisi puramente topologica non lo vedrebbe. Serve almeno un controllo di similarità tra la spec del nodo generatore e i criteri prodotti a monte, con avviso all'autore. È il controllo più importante dell'intero sistema e non va rimandato.

---

## 5. Il calcolo della sicurezza

```
punteggio_grezzo = 4 − Σ(peso di ogni marcatore presente)
sicurezza        = clamp(punteggio_grezzo, 1, 4)
```

Conta **la gravità, non la frazione**: un solo `arbitrary-code-execution` pesa più di quattro nodi puliti. Un marcatore presente su più nodi conta una volta sola per il blueprint, ma la spiegazione elenca **tutti** i nodi che l'hanno fatto scattare (doc 1 §8.3).

---

## 6. Il calcolo dell'autonomia

```
frazione = nodi il cui type NON è ⊂ human-in-the-loop / nodi totali
```

Fasce iniziali, da tarare:

| Frazione | Livello |
|---|---|
| > 0.90 | 4 |
| 0.70 – 0.90 | 3 |
| 0.50 – 0.70 | 2 |
| < 0.50 | 1 |

> Il risultato si presenta come *autonomia livello N*, mai come *N su 4* con barra di progresso (doc 2 §1.1). L'indicatore mostra **dove** sono gli interventi umani, non quanto manca alla piena autonomia.

---

## 7. Namespace locali

Un utente estende il vocabolario nel proprio namespace, con il formato `<utente>/<voce>`:

```
type: berti/simulation-node
risk_markers: [berti/persistent-memory-risk]
```

Regole:

- Estendibili nei namespace locali: `type` e `risk_markers`.
- **Non** estendibile: `phase`. Le cinque fasi sono chiuse.
- Una voce locale **deve dichiarare da quale voce del nucleo discende**, altrimenti l'analisi statica non sa come trattarla e la ignora silenziosamente, che è il peggior esito possibile.
- Un marcatore locale deve dichiarare un peso, altrimenti vale 0 e non incide.
- I conteggi d'uso per la promozione **escludono i blueprint privati** (doc 2 §6.4).

---

## 8. Versionamento

Ogni card e ogni blueprint dichiara `ontology_version`. L'ontologia usa versionamento semantico:

| Componente | Quando incrementa |
|---|---|
| MAJOR | una voce viene deprecata o il significato di una voce cambia |
| MINOR | si aggiungono voci o relazioni |
| PATCH | si correggono descrizioni o si tarano i pesi |

Cambiare un peso è **PATCH**, ma ricalcola i punteggi di tutti i blueprint. La scheda deve indicare **con quale versione dell'ontologia** un punteggio è stato calcolato, altrimenti due valutazioni non sono confrontabili e si perde la riproducibilità che tutto il §4 del documento 1 serviva a garantire.

---

## 9. Aperto in v0.1

- Taratura dei pesi (§4) e delle fasce (§6) su dati reali
- Soglia di similarità per il controllo `criteria-leak` sulle spec (§4.1)
- Se `tool` vada spezzato in sottotipi quando la libreria di nodi crescerà
- Soglie di promozione dal namespace locale al nucleo (doc 1 §7)
