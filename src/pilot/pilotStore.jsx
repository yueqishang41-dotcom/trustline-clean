import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { buildFixedPaper } from './pilotPaper';
import { flushPendingUploads } from './pilotUpload';
import { isPilotClosed } from './pilotGate';

const STORAGE_KEY = 'trustline_pilot_state';

// ============ 试卷类型分配（三保险分流） ============
function assignFormType() {
  // 优先级一：URL 硬性指定 ?form=A / ?form=B / ?form=C
  try {
    const sp = new URLSearchParams(window.location.search);
    const f = (sp.get('form') || '').trim().toUpperCase();
    if (['A', 'B', 'C'].includes(f)) return f;
  } catch (e) {}

  // 优先级二：时间戳轮询轮发（Timestamp % 3），交替 A->B->C
  const ts = Date.now();
  const idx = Math.floor(ts / 1000) % 3; // 以秒级时间戳取余，避免同毫秒扎堆
  return ['A', 'B', 'C'][idx];
}

export const FORM_TYPE = assignFormType();
export const FORM_LABEL = { A: 'Form_A', B: 'Form_B', C: 'Form_C' }[FORM_TYPE] || 'Form_A';

const initialState = {
  subject: { id: '', name: '', role: '' },
  formType: FORM_TYPE,
  formLabel: FORM_LABEL,
  phase: 'subject-info', // subject-info | instructions | moduleA | moduleBTransition | moduleB | completion
  moduleAQuestions: [],
  moduleBQuestions: [],
  moduleACurrentIndex: 0,
  moduleAResponses: {},
  energyPoints: 20,
  evidenceUnlocked: false,
  moduleBCurrentIndex: 0,
  moduleBResponses: {},
  startTime: null,
  endTime: null,
  results: null,
  behavioralLogs: [],
  pageBlurCount: 0,
  bulkPasteCount: 0,
  // 上传状态（不持久化的运行时字段单独放 ref）
};

const actions = {
  SET_SUBJECT: 'SET_SUBJECT',
  START_TEST: 'START_TEST',
  SET_PHASE: 'SET_PHASE',
  SET_MODULE_A_INDEX: 'SET_MODULE_A_INDEX',
  UPDATE_MODULE_A_RESPONSE: 'UPDATE_MODULE_A_RESPONSE',
  CONSUME_ENERGY: 'CONSUME_ENERGY',
  SET_EVIDENCE_LOCKED: 'SET_EVIDENCE_LOCKED',
  SET_MODULE_B_INDEX: 'SET_MODULE_B_INDEX',
  UPDATE_MODULE_B_RESPONSE: 'UPDATE_MODULE_B_RESPONSE',
  FINISH_TEST: 'FINISH_TEST',
  ADD_LOG: 'ADD_LOG',
  ADD_PAGE_BLUR: 'ADD_PAGE_BLUR',
  ADD_BULK_PASTE: 'ADD_BULK_PASTE',
  RESET: 'RESET',
};

export function createLogEntry(action, detail, metadata = {}) {
  return { timestamp: new Date().toISOString(), action, detail, ...metadata };
}

function testReducer(state, action) {
  switch (action.type) {
    case actions.SET_SUBJECT:
      return { ...state, subject: action.payload };

    case actions.START_TEST: {
      // 防御：已过关闭时间则拒绝开启新测试（路由层已拦截，此处双保险）
      if (isPilotClosed()) {
        return { ...state, behavioralLogs: [...state.behavioralLogs, createLogEntry('test_blocked', '预实验已关闭，拒绝开始')] };
      }
      const paper = buildFixedPaper(state.formType);
      return {
        ...state,
        phase: 'moduleA',
        moduleAQuestions: paper.moduleA,
        moduleBQuestions: paper.moduleB,
        startTime: new Date().toISOString(),
        moduleACurrentIndex: 0,
        moduleBCurrentIndex: 0,
        energyPoints: 20,
        evidenceUnlocked: false,
        moduleAResponses: {},
        moduleBResponses: {},
        behavioralLogs: [createLogEntry('test_start', `Pilot test started (${state.formLabel})`)],
      };
    }

    case actions.SET_PHASE:
      return { ...state, phase: action.payload };

    case actions.SET_MODULE_A_INDEX:
      return { ...state, moduleACurrentIndex: action.payload, evidenceUnlocked: false };

    case actions.UPDATE_MODULE_A_RESPONSE: {
      const { questionId, data } = action.payload;
      return {
        ...state,
        moduleAResponses: {
          ...state.moduleAResponses,
          [questionId]: { ...state.moduleAResponses[questionId], ...data },
        },
      };
    }

    case actions.CONSUME_ENERGY: {
      const cost = action.payload;
      return { ...state, energyPoints: Math.max(0, state.energyPoints - cost) };
    }

    case actions.SET_EVIDENCE_LOCKED:
      return { ...state, evidenceUnlocked: action.payload };

    case actions.SET_MODULE_B_INDEX:
      return { ...state, moduleBCurrentIndex: action.payload };

    case actions.UPDATE_MODULE_B_RESPONSE: {
      const { questionId, data } = action.payload;
      return {
        ...state,
        moduleBResponses: {
          ...state.moduleBResponses,
          [questionId]: { ...state.moduleBResponses[questionId], ...data },
        },
      };
    }

    case actions.ADD_LOG:
      return { ...state, behavioralLogs: [...state.behavioralLogs, action.payload] };

    case actions.ADD_PAGE_BLUR:
      return { ...state, pageBlurCount: state.pageBlurCount + 1 };

    case actions.ADD_BULK_PASTE:
      return { ...state, bulkPasteCount: state.bulkPasteCount + 1 };

    case actions.FINISH_TEST: {
      const endTime = new Date().toISOString();
      const logs = [...state.behavioralLogs, createLogEntry('test_complete', 'Pilot test completed')];
      return {
        ...state,
        phase: 'completion',
        endTime,
        results: {
          subjectId: state.subject.id,
          name: state.subject.name,
          role: state.subject.role,
          formType: state.formType,
          formLabel: state.formLabel,
          startTime: state.startTime,
          endTime,
          timeUsedSec: Math.round((new Date(endTime) - new Date(state.startTime)) / 1000),
          energyRemaining: state.energyPoints,
          moduleAQuestionsInfo: state.moduleAQuestions,
          moduleBQuestionsInfo: state.moduleBQuestions,
          moduleAResponses: state.moduleAResponses,
          moduleBResponses: state.moduleBResponses,
          behavioralLogs: logs,
          pageBlurCount: state.pageBlurCount,
          bulkPasteCount: state.bulkPasteCount,
        },
        behavioralLogs: logs,
      };
    }

    case actions.RESET: {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      return { ...initialState };
    }

    default:
      return state;
  }
}

const PilotContext = createContext(null);
const PilotDispatchContext = createContext(null);

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const VALID = ['subject-info', 'instructions', 'moduleA', 'moduleBTransition', 'moduleB', 'completion'];
    if (!data || !data.phase || !VALID.includes(data.phase)) { localStorage.removeItem(STORAGE_KEY); return null; }
    if (!data.subject || typeof data.subject.id !== 'string') { localStorage.removeItem(STORAGE_KEY); return null; }
    return data;
  } catch (e) { return null; }
}

export function PilotProvider({ children }) {
  const savedState = loadState();
  const [state, dispatch] = useReducer(testReducer, savedState || initialState);

  useEffect(() => {
    if (state.phase !== 'subject-info') {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }
  }, [state]);

  // ===== 自动补传上次失败的云端上传（静默，被试无感） =====
  useEffect(() => {
    flushPendingUploads().catch(() => {});
  }, []);

  // ===== 防作弊监控 1：切屏/焦点丢失 =====
  useEffect(() => {
    const onBlur = () => {
      dispatch({ type: actions.ADD_PAGE_BLUR });
      dispatch({
        type: actions.ADD_LOG,
        payload: createLogEntry('page_blur', '被试离开测试页面'),
      });
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);

  return (
    <PilotContext.Provider value={state}>
      <PilotDispatchContext.Provider value={dispatch}>
        {children}
      </PilotDispatchContext.Provider>
    </PilotContext.Provider>
  );
}

export function usePilotState() {
  const ctx = useContext(PilotContext);
  if (!ctx) throw new Error('usePilotState must be used within PilotProvider');
  return ctx;
}

export function usePilotDispatch() {
  const ctx = useContext(PilotDispatchContext);
  if (!ctx) throw new Error('usePilotDispatch must be used within PilotProvider');
  return ctx;
}

export function usePilotActions() {
  const dispatch = usePilotDispatch();
  const state = usePilotState();

  const setSubject = useCallback((s) => dispatch({ type: actions.SET_SUBJECT, payload: s }), [dispatch]);
  const setPhase = useCallback((p) => dispatch({ type: actions.SET_PHASE, payload: p }), [dispatch]);
  const startTest = useCallback(() => dispatch({ type: actions.START_TEST }), [dispatch]);

  const updateModuleAResponse = useCallback((questionId, data) =>
    dispatch({ type: actions.UPDATE_MODULE_A_RESPONSE, payload: { questionId, data } }), [dispatch]);

  const consumeEnergy = useCallback((cost, actionName, questionId) => {
    dispatch({ type: actions.CONSUME_ENERGY, payload: cost });
    dispatch({ type: actions.ADD_LOG, payload: createLogEntry(actionName || 'energy_consumed', `Cost: ${cost}`, { energyCost: cost, questionId: questionId || null }) });
  }, [dispatch]);

  const setEvidenceUnlocked = useCallback((val) => dispatch({ type: actions.SET_EVIDENCE_LOCKED, payload: val }), [dispatch]);
  const updateModuleBResponse = useCallback((questionId, data) =>
    dispatch({ type: actions.UPDATE_MODULE_B_RESPONSE, payload: { questionId, data } }), [dispatch]);

  // 防作弊监控 2：异常大段粘贴（>100 字符）
  const addBulkPaste = useCallback((length) => {
    dispatch({ type: actions.ADD_BULK_PASTE });
    dispatch({
      type: actions.ADD_LOG,
      payload: createLogEntry('bulk_paste_detected', '检测到大段文本粘贴', { length }),
    });
  }, [dispatch]);

  const goToNextModuleA = useCallback(() => {
    if (state.moduleACurrentIndex < state.moduleAQuestions.length - 1) {
      dispatch({ type: actions.SET_MODULE_A_INDEX, payload: state.moduleACurrentIndex + 1 });
    } else {
      dispatch({ type: actions.SET_PHASE, payload: 'moduleBTransition' });
    }
  }, [state.moduleACurrentIndex, state.moduleAQuestions.length, dispatch]);

  const goToNextModuleB = useCallback(() => {
    if (state.moduleBCurrentIndex < state.moduleBQuestions.length - 1) {
      dispatch({ type: actions.SET_MODULE_B_INDEX, payload: state.moduleBCurrentIndex + 1 });
    } else {
      dispatch({ type: actions.FINISH_TEST });
    }
  }, [state.moduleBCurrentIndex, state.moduleBQuestions.length, dispatch]);

  const finishTest = useCallback(() => dispatch({ type: actions.FINISH_TEST }), [dispatch]);

  const reset = useCallback(() => dispatch({ type: actions.RESET }), [dispatch]);

  return {
    setSubject, setPhase, startTest,
    updateModuleAResponse, consumeEnergy, setEvidenceUnlocked,
    updateModuleBResponse, goToNextModuleA, goToNextModuleB, finishTest, reset,
    addBulkPaste,
  };
}
