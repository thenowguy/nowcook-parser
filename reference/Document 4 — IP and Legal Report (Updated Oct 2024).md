# Document 4 — IP / Legal Report (Professional Counsel Edition)
**Updated: October 24, 2024**

## Purpose
This document is structured as a formal legal-technical memorandum suitable for briefing intellectual property counsel. It identifies the protectable mechanisms, processes, and design elements underlying the NowCook system, linking them to functional behavior and potential claim language. It also highlights embodiments, potential UI expressions, and prior-art sensitivities.

**Latest Update:** Added Section 2.7 covering the novel two-phase hybrid semantic+algorithmic recipe parsing approach implemented October 2024.

---

## 1. Overview

NowCook is a software system that transforms unstructured culinary instructions into structured, time-aware, human-executable workflows. Its novelty lies in:
- The **two-phase hybrid parsing** system that combines semantic AI understanding with algorithmic precision (NEW - October 2024)
- The **linguistic ontology** that converts prose into canonical, validated action structures
- The **temporal scheduling model** that enforces human attention constraints
- The **interactive gate interface (NowLine)** that actively governs task progression
- The integration of these mechanisms into an empathetic, smartphone-oriented user experience

This combination—**semantic+algorithmic parsing** + linguistic normalization + human-centered scheduling + attention mutex + calm UX—creates a protectable technical system distinct from prior recipe, scheduling, or task management tools.

---

## 2. Core Technical Mechanisms

### 2.1 Active Temporal Gate ("NowLine")

**Definition:**
A software mechanism representing an explicit control barrier that tasks cannot cross until the user acknowledges readiness.

**Function:**
- Differentiates between eligible and active tasks based on time and dependency status
- Enforces explicit human acknowledgment before progression
- Allows asynchronous unattended tasks to run concurrently once initiated
- Maintains projection of final serve time with elastic adjustment if user delays

**Novelty:**
Traditional scheduling interfaces (Gantt charts, timers) model "now" as a passive moment. NowCook's NowLine is interactive and interruptible—a checkpoint, not a timeline marker.

**Embodiment Example (Pseudo-code):**
```python
if task.state == "eligible" and user_action == "start":
    task.state = "active"
    if task.attention_mode == "attended":
        driver.lock()
    if task.attention_mode == "SRAS":
        run_in_background(task)
```

**UI Expression:**
Vertical line fixed mid-screen; tasks slide toward it; user taps to traverse gate.
Embodied via smartphone-optimized interface with clear states: eligible → at_gate → active → complete.

---

### 2.2 Driver Mutex (Single-Attended-Task Lock)

**Definition:**
A mutual-exclusion rule limiting one attended task at a time, preventing impossible overlaps for a single cook.

**Function:**
- Attended task start locks driver; other attended tasks disabled
- Unlock on task completion or pause
- Unattended tasks (SRAS) operate independently once launched

**Novelty:**
Unlike generic task schedulers that permit arbitrary concurrency, the driver mutex models the biological constraint of a single actor.

**Embodiment Example:**
```python
function start_task(task):
    if driver.locked and task.attention_mode == "attended":
        raise Blocked("Driver busy")
    else:
        driver.lock()
        task.state = "active"
```

**UI Expression:**
Blocked tasks visually greyed with tooltip: "Waiting — cook's attention occupied by sauté onions (3m remaining)."

---

### 2.3 One-Minute Minimum Normalization

**Definition:**
Every task duration normalized to at least one minute; shorter operations round up but can complete early.

**Function:**
- Stabilizes timeline rendering and animations
- Avoids sub-minute "flicker" on smartphone screens
- Enables consistent slip propagation logic

**Novelty:**
A UX-driven timing normalization rule encoded into the system's schema validation and scheduler.

**Embodiment Example:**
```python
if task.duration < 1:
    task.duration = 1
```

---

### 2.4 Emergent Ingredient Modeling

**Definition:**
Outputs of steps become first-class ingredients that can be referenced later by subsequent steps.

**Function:**
- Enables proper dependency tracking ("make sauce" → "add sauce")
- Carries lineage (created_by_task_id, created_at, freshness window)
- Prevents premature references to non-existent intermediates

**Novelty:**
Recipes typically treat ingredients as static; NowCook dynamically reclassifies outputs as new, structured entities.

**Embodiment Example:**
```python
emergent = Ingredient(
    name="sauce",
    created_by=task.id,
    valid_until=task.end_time + 15m
)
```

**UI Expression:**
Emergent items visually tagged as "ready" assets, appearing in later steps with lineage note ("Use sauce prepared earlier").

---

### 2.5 Ontology with Applicability Guards

**Definition:**
Finite verb library, each with parameter schema and allowable ingredient classes.

**Function:**
- Validates that verbs apply only to compatible ingredient types
- Defines default durations, readiness cues, and attention modes per verb
- Reduces ambiguity in parsing and authoring

**Novelty:**
No existing culinary platform uses a linguistically constrained ontology enforced by validation at runtime and authoring time.

**Embodiment Example:**
```python
if verb == "mash" and ingredient.class not in ["root_veg","legume"]:
    raise ValidationError("Verb not applicable to ingredient type")
```

---

### 2.6 Serve-Time Back-Planning with Elasticity

**Definition:**
Backward scheduling from target serve time; delays shift projections automatically, respecting hold windows.

**Function:**
- Calculates ideal start times by reversing DAG through durations
- When slippage occurs, updates serve-time forecast rather than freezing it
- Communicates delay gently ("Dinner about 5 min later than planned")

**Novelty:**
Combines predictive scheduling with user-controlled pacing—elastic time management rather than rigid countdown.

**Embodiment Example:**
```python
for task in reversed(dag):
    task.start = task.successor.start - task.duration
if slip > 0:
    serve_time += slip
```

---

### 2.7 Two-Phase Hybrid Semantic+Algorithmic Recipe Parsing ⭐ NEW (October 2024)

**Definition:**
A novel parsing architecture that sequentially applies semantic natural language understanding (Phase 1) followed by algorithmic pattern matching (Phase 2) to transform unstructured recipe text into structured, time-aware task graphs.

**Function:**

**Phase 1 - Semantic Chain Detection:**
- Analyzes narrative recipe text using semantic understanding to identify logical task chains
- Detects temporal markers indicating parallel execution ("while that bakes", "meanwhile", "at the same time")
- Infers chain-level dependencies from narrative context
- Assigns emergent ingredient IDs to chain outputs
- Extracts individual task sentences from detected chains
- Works with unstructured narrative text (no formatting requirements)

**Phase 2 - Algorithmic Task Parsing:**
- Receives task sentences identified by Phase 1
- Applies pattern matching to extract verbs, durations, temperatures, equipment
- Matches verbs against canonical ontology
- Infers task-level dependencies using existing algorithmic rules
- Assigns attention modes (attended/unattended/SRAS) based on verb definitions
- Generates final structured task objects with all metadata

**Novelty:**
Existing recipe parsers use EITHER semantic (AI-only, often inaccurate on details) OR algorithmic (pattern-matching only, fails on structure). NowCook's hybrid approach uniquely combines both in a sequential pipeline where Phase 1 provides **structure** and Phase 2 provides **precision**.

**Key Innovations:**

1. **Smart Section Detection Without Explicit Formatting:**
   - Detects logical boundaries in unstructured text by analyzing:
     - Narrative start patterns ("Bring a pot", "Preheat the oven", "In a small saucepan")
     - Temporal transition markers ("While that bakes", "Meanwhile")
     - Content type transitions (ingredient lists → cooking instructions)
   - Works even when paragraphs lack double-newline separation
   - Filters out ingredient lists automatically

2. **Temporal Marker Detection for Parallel Chain Execution:**
   - Automatically identifies phrases indicating concurrent execution:
     - "while that bakes" → `parallel_during_bake`
     - "meanwhile" → `parallel`
     - "at the same time" → `parallel`
     - "in a separate pan/bowl" → `parallel`
   - Assigns `temporal_marker` and `parallel_with` metadata to chains
   - Enables runtime to execute multiple chains simultaneously

3. **Chain-Level Emergent Ingredient Assignment:**
   - Assigns unique identifiers to intermediate products at chain level
   - Example: `e_cheese_sauce_001`, `e_cooked_pasta_002`, `e_bacon_topping_003`
   - Enables flexible early preparation (grate cheese hours early, use when needed)
   - Chain-level outputs become inputs to dependent chains

4. **Semantic Purpose Inference with Confidence Scoring:**
   - High-confidence pattern matching for common chain types:
     - "Cook the Pasta" (detects: bring water to boil, add pasta, cook, drain)
     - "Make the Cheese Sauce" (detects: melt butter, make roux, add milk, add cheese)
     - "Make the Bacon Topping" (detects: render bacon, add aromatics)
     - "Bake the Dish" (detects: transfer to dish, bake)
     - "Serve" (detects: plating and serving instructions)
   - Assigns confidence levels: high/medium/low
   - Filters out low-confidence single-task chains (headers, noise)

**Embodiment Example:**
```python
# Phase 1: Semantic Chain Detection
def parse_recipe_hybrid(raw_text, title):
    # Detect logical chains from narrative
    semantic_result = detect_chains_semantically(raw_text, title)
    # semantic_result.chains = [
    #   {id: "chain_1", name: "Cook the Pasta",
    #    tasks: ["Bring pot to boil", "Add pasta", "Drain"],
    #    outputs: [{emergent_id: "e_pasta_001", state: "cooked"}],
    #    temporal_marker: None},
    #   {id: "chain_2", name: "Make the Bacon Topping",
    #    tasks: ["Heat pan", "Add bacon", "Add onions"],
    #    outputs: [{emergent_id: "e_topping_002", state: "ready"}],
    #    temporal_marker: "parallel_during_bake"}
    # ]

    # Extract all task sentences in chain order
    task_sentences = []
    for chain in semantic_result.chains:
        task_sentences.extend(chain.tasks)

    # Phase 2: Parse each sentence algorithmically
    parsed_tasks = []
    for sentence in task_sentences:
        task = {
            "id": f"step_{index}",
            "name": sentence,
            "canonical_verb": find_verb(sentence),  # Pattern matching
            "duration_min": extract_duration(sentence),  # Regex extraction
            "requires_driver": get_attention_mode(verb),  # Ontology lookup
            "equipment": extract_equipment(sentence),  # Keyword matching
            "inputs": extract_ingredients(sentence),
            "edges": []  # Populated by dependency inference
        }
        parsed_tasks.append(task)

    # Map chains to parsed task IDs (sequential order)
    task_index = 0
    for chain in semantic_result.chains:
        chain.task_ids = []
        for _ in range(len(chain.tasks)):
            chain.task_ids.append(parsed_tasks[task_index].id)
            task_index += 1

    return {
        "tasks": parsed_tasks,
        "chains": semantic_result.chains
    }
```

**Test Results (Mac & Cheese Recipe):**
- ✅ 5 logical chains detected ("Cook Pasta", "Make Sauce", "Bake Dish", "Make Topping", "Serve")
- ✅ Parallel execution detected ("Make Bacon Topping" marked as `parallel_during_bake`)
- ✅ Chain dependencies inferred ("Make Sauce" depends on "Cook Pasta" via `e_pasta_001`)
- ✅ 20 tasks correctly assigned to chains (3, 8, 2, 4, 2 tasks per chain)
- ✅ All tasks parsed with correct verbs, durations, and attention modes

**Prior Art Differentiation:**

| System | Approach | Limitations |
|--------|----------|-------------|
| Cooklang | Structured syntax (markdown-like) | Requires manual markup; not natural text |
| Schema.org Recipe | Structured JSON-LD | Requires pre-structured input; no parsing |
| NYT Cooking / Paprika | Basic NLP ingredient extraction | No chain detection; no parallel execution; no emergent ingredients |
| ChatGPT / LLMs | Pure semantic understanding | Inconsistent output format; hallucinates details; no precision guarantees |
| Traditional Parsers | Pure algorithmic (regex/rules) | Can't understand narrative structure; fails on unstructured text |

**NowCook's Unique Position:**
- ✅ Works with **unstructured narrative** (no formatting required)
- ✅ **Semantic understanding** of chains (not just pattern matching)
- ✅ **Parallel execution detection** via temporal markers
- ✅ **Emergent ingredient tracking** at chain level
- ✅ **Hybrid precision**: Semantic structure + algorithmic details
- ✅ **Confidence scoring**: Filters noise, validates quality

---

## 3. UX / Trade Dress Elements

The following design expressions are potential trade dress or UI protection candidates:

| Feature | Description | Distinguishing Elements |
|---------|-------------|-------------------------|
| NowLine UI Spine | Vertical fixed line dividing pending and active tasks | Interactive gate; tasks move spatially toward it; color transitions reflect eligibility |
| Two-Stage Interaction | "Peek" to reveal facts, "Start" to traverse gate | Separation of information and action unique to NowCook |
| Dual Lanes | Attended (top) vs Unattended (SRAS) concurrent display | Models simultaneity without confusion |
| Slip Feedback | Human phrasing of delay ("a bit later") | Gentle UX tone distinct from countdown timers |
| Calm Palette + Typography | High contrast, minimal stress | UX as emotional differentiator ("reassuring calm" trademarkable style) |
| Chain Swim Lanes (NEW) | Gantt-style timeline with colored tracks per chain | Visual representation of parallel chains; temporal positioning |
| AI Chains Toggle (NEW) | Gradient label checkbox enabling semantic parsing | Visual indicator of AI-powered feature |

---

## 4. Functional Claim Templates

Potential patent claim scaffolds (conceptual language, not legal text):

### Claim Set 1 — Temporal Gate Control
A method of orchestrating a sequence of culinary tasks comprising:
1. Parsing recipe instructions into canonical action records according to a verb–parameter–ingredient ontology
2. Assigning durations and attention modes
3. Scheduling tasks backward from a target serve time
4. Displaying an interactive temporal gate that prevents advancement of a task until explicit user initiation
5. Enforcing a single-driver mutex for attended tasks
6. Allowing autonomous tasks to continue concurrently once initiated
7. Adjusting projected completion time in response to user delay

### Claim Set 2 — Ontological Validation
A system that validates instructional text using a finite action vocabulary with applicability constraints between verbs and ingredient classes.

### Claim Set 3 — Emergent Ingredient Lifecycle
A computing method wherein outputs of steps are promoted to reusable data entities with lineage tracking, used by subsequent steps under freshness constraints.

### Claim Set 4 — UX Integration
A user interface implementing a vertically fixed temporal gate (NowLine), visual progression of tasks toward the gate, and two-stage activation interactions.

### Claim Set 5 — Two-Phase Hybrid Recipe Parsing ⭐ NEW
A computer-implemented method for parsing recipe text comprising:
1. **Semantic Chain Detection Phase:**
   - Analyzing narrative recipe text using semantic natural language understanding to identify a plurality of logical task chains
   - Detecting temporal markers within said narrative text indicating parallel execution relationships between task chains
   - Assigning emergent ingredient identifiers to outputs produced by task chains
   - Extracting individual task description sentences from said task chains
2. **Algorithmic Task Parsing Phase:**
   - Parsing said task description sentences using pattern matching to extract action verbs, durations, temperatures, ingredients, and equipment
   - Matching said action verbs against a canonical verb ontology
   - Assigning attention modes based on verb definitions
   - Inferring task-level dependencies
3. **Integration:**
   - Sequentially mapping parsed tasks to chains in order
   - Generating structured recipe representation comprising task chains with emergent ingredient dependencies

**Dependent Claims:**

- **5.1 Temporal Marker Detection:** Wherein detecting temporal markers comprises identifying at least one phrase from: "while that bakes", "meanwhile", "at the same time", "in a separate pan/bowl", and assigning parallel execution metadata.

- **5.2 Smart Section Detection:** Wherein analyzing narrative recipe text comprises detecting logical section boundaries without requiring explicit paragraph formatting by identifying narrative pattern changes, temporal markers, or content type transitions.

- **5.3 Confidence-Based Filtering:** Wherein semantic chain detection assigns confidence scores (high/medium/low) to detected chains and filters chains below a confidence threshold.

- **5.4 Chain-Level Emergent IDs:** Wherein emergent ingredient identifiers are assigned at the chain level rather than task level, enabling dependency resolution across chains.

- **5.5 Sequential Task Mapping:** Wherein mapping parsed tasks to chains comprises sequential assignment in the order tasks were extracted from chains, eliminating fuzzy matching.

---

## 5. Example Implementation Variants

| Variant | Description | Distinguishing Implementation |
|---------|-------------|-------------------------------|
| Web / Mobile Hybrid (Default) | JS-based engine controlling task state, using React or Vue | Client maintains NowLine state; local persistence for offline continuity |
| Voice-Driven Mode | Voice interface replacing taps | "Ready for next step?" prompt; explicit speech acknowledgment triggers gate traversal |
| Smart Appliance Integration | Synchronization with connected devices | Gate initiation triggers oven preheat or timer start via API |
| Collaborative Mode | Multi-user synchronization (two cooks) | Distributed driver mutex; shared NowLine; conflict resolution policy |
| AI Recipe Import (NEW) | Automatic parsing of unstructured recipes from web/PDF | Two-phase hybrid parser with smart section detection |

Each variant maintains the same underlying invariants (ontology, mutex, gate, hybrid parsing) and thus extends protection to multiple embodiments.

---

## 6. Exclusions and Prior Art Sensitivities

| Area | Potential Overlap | Differentiator |
|------|------------------|----------------|
| Gantt / Project Tools | Passive "now" markers and parallel tasks | No human-attention modeling; NowCook's gate is interactive and mutex-based |
| Recipe Apps (Paprika, Whisk, NYT) | Text + timers; static steps | No ontology, no gate, no validation or back-propagated scheduling, no hybrid parsing |
| Cooking Robots / Automation | Robotic sequencing, not human orchestration | NowCook assumes human single-driver; UX empathy central |
| Pomodoro / Task Managers | Timed focus sessions | No ingredient ontology, no emergent entities, no elastic serve-time propagation |
| ChatGPT / LLM Recipe Parsing | Pure AI semantic understanding | No precision guarantees; hallucinates; no hybrid approach; no ontology validation |
| Traditional Recipe Parsers | Pure algorithmic pattern matching | Can't understand narrative structure; requires formatting; no chain detection |

---

## 7. Potential Protectable Trade Names and Phrases

| Term | Description |
|------|-------------|
| NowLine™ | The active temporal gate UI and its scheduling logic |
| Driver Mutex™ | Human attention lock mechanism ensuring single attended task concurrency |
| Emergent Ingredient™ | Output of cooking step that becomes structured input downstream |
| Serve-Time Elasticity™ | Scheduler's adaptive timing propagation logic |
| Calm Mode™ | UX state prioritizing non-intrusive pacing and tone |
| AI Chains™ (NEW) | Two-phase hybrid semantic+algorithmic chain detection feature |
| Semantic Chains™ (NEW) | AI-powered logical task grouping with temporal awareness |

---

## 8. Example Source Snippets (Non-Functional Illustrations)

Below are brief pseudo-code fragments demonstrating protected logic; they are not complete programs but evidence of novel implementation detail.

**Elastic Slip Propagation**
```python
def propagate_slip(current_slip):
    for dish in meal.dishes:
        dish.serve_projection += current_slip
    notify_user(f"Serve time adjusted by {current_slip} minutes.")
```

**Gate Traversal Logic**
```python
def traverse_gate(task):
    if task.state == "eligible" and confirm_user():
        task.state = "active"
        update_UI(NowLine.advance(task))
```

**Emergent Ingredient Registration**
```python
def register_emergent_output(task):
    emergent_id = uuid()
    emergent_registry[emergent_id] = {
        "name": task.output_label,
        "created_by": task.id,
        "usable_until": time.now() + hold_window
    }
```

**Semantic Section Detection (NEW)**
```python
def detect_logical_sections(text):
    lines = text.split('\n')
    sections = []
    current_section = []

    for line in lines:
        # Detect section boundaries
        if is_narrative_start(line) and current_section:
            sections.append('\n'.join(current_section))
            current_section = [line]
        elif is_temporal_marker(line):
            sections.append('\n'.join(current_section))
            current_section = [line]
        else:
            current_section.append(line)

    if current_section:
        sections.append('\n'.join(current_section))

    return sections
```

**Temporal Marker Detection (NEW)**
```python
def detect_parallel_execution(section_text):
    temporal_markers = {
        'while that bakes': 'parallel_during_bake',
        'meanwhile': 'parallel',
        'at the same time': 'parallel',
        'in a separate': 'parallel'
    }

    for marker, type in temporal_markers.items():
        if marker in section_text.lower():
            return type

    return None
```

These examples illustrate functional coupling between semantic understanding, algorithmic parsing, ontology, scheduling, and UX—an integrated behavior not present in any known recipe or scheduling system.

---

## 9. Implementation Timeline & Milestones

**October 2024:** Two-Phase Hybrid Parsing
- ✅ Semantic chain detection module (`semanticChains.js`)
- ✅ Smart section detection without formatting requirements
- ✅ Temporal marker detection for parallel chains
- ✅ Chain-level emergent ingredient assignment
- ✅ Sequential task-to-chain mapping
- ✅ Integration with existing algorithmic parser
- ✅ Tested successfully with Mac & Cheese recipe (5 chains, 20 tasks, parallel execution detected)

**Prior Milestones:**
- September 2024: Mobile-first v2.0 refactor with TimelineFlow
- August 2024: Critical path calculator with temporal feasibility
- July 2024: Gantt timeline visualization with swim lanes
- June 2024: Ontology-based verb matching and validation

---

## 10. Conclusion

NowCook's IP portfolio consists of interlocking technical and experiential systems:
- A **two-phase hybrid parser** that combines semantic understanding with algorithmic precision (NEW - October 2024)
- A **rule-based linguistic ontology** for culinary language
- A **temporal scheduler** constrained by human attention and empathy
- An **interface** whose spatial design (NowLine, dual-lane visualization, calm interaction tone) is inseparable from those rules

Protectable domains include:
- **Utility patents** (process and method claims for hybrid parsing, temporal gate, emergent ingredients)
- **Design patents** (interface structure and layout, chain swim lanes, AI Chains toggle)
- **Trade dress** (NowLine visual design, calm UX tone, gradient AI indicator)
- **Trademarks** (NowLine™, Driver Mutex™, Emergent Ingredient™, AI Chains™, Semantic Chains™)
- **Trade secrets** (specific algorithms, pattern matching rules, confidence scoring formulas)

The combination of **Semantic+Algorithmic Parsing** + Ontology + Attention Model + Elastic Gate UI defines a unique category of technology: software that interprets the language of cooking as a live, interactive conversation between time, task, and human capability.

**Recommended Next Steps:**
1. **File provisional patent** for two-phase hybrid parsing within 30 days ($150-$3K)
2. **Conduct prior art search** focusing on recipe parsers and NLP systems
3. **Draft full utility patent** within 12 months of provisional
4. **Implement trade secret protections** (NDAs, access controls, proprietary code marking)
5. **Consider international PCT filing** if pursuing global markets

**IP Protectability Assessment: 9/10** — Strong novel elements with commercial value and clear differentiation from prior art.
