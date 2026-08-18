import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { buildFormalPaper } from '../utils/generateTestPaper';
import { runFullScoring } from '../utils/scoringEngine';
import { saveState, loadState, clearState, createLogEntry } from '../utils/storage';
import { setKioskLock } from '../utils/kiosk';

const initialState = {
  subject: { id: '', name: '', role: '' },
  phase: 'subject-info', // subject-info | instructions | moduleA | moduleB | completion
  moduleAQuestions: [],
  moduleBQuestions: [],
  moduleACurrentIndex: 0,
  moduleAResponses: {},
  energyPoints: 20,
  evidenceUnlocked: false,
  highlighted: false,
  moduleBCurrentIndex: 0,
  moduleBResponses: {},
  startTime: null,
  endTime: null,
  results: null,
  behavioralLogs: [],
  bulkPasteCount: 0,
  pageBlurCount: 0,
};

const actions = {
  SET_SUBJECT: 'SET_SUBJECT',
  START_TEST: 'START_TEST',
  SET_PHASE: 'SET_PHASE',
  SET_MODULE_A_INDEX: 'SET_MODULE_A_INDEX',
  UPDATE_MODULE_A_RESPONSE: 'UPDATE_MODULE_A_RESPONSE',
  CONSUME_ENERGY: 'CONSUME_ENERGY',
  SET_EVIDENCE_LOCKED: 'SET_EVIDENCE_LOCKED',
  SET_HIGHLIGHTED: 'SET_HIGHLIGHTED',
  SET_MODULE_B_INDEX: 'SET_MODULE_B_INDEX',
  UPDATE_MODULE_B_RESPONSE: 'UPDATE_MODULE_B_RESPONSE',
  FINISH_TEST: 'FINISH_TEST',
  ADD_LOG: 'ADD_LOG',
  ADD_BULK_PASTE: 'ADD_BULK_PASTE',
  ADD_PAGE_BLUR: 'ADD_PAGE_BLUR',
  ADD_PAGE_BLUR_RETURN: 'ADD_PAGE_BLUR_RETURN',
  RESET: 'RESET',
};

function testReducer(state, action) {
  switch (action.type) {
    case actions.SET_SUBJECT:
      return { ...state, subject: action.payload };

    case actions.START_TEST: {
      // 正式卷固定抽题（dsh-A 6题 + zxy-B 10题）
      const paper = buildFormalPaper();
      const now = new Date().toISOString();
      return {
        ...state,
        phase: 'moduleA',
        moduleAQuestions: paper.moduleA,
        moduleBQuestions: paper.moduleB,
        startTime: now,
        moduleACurrentIndex: 0,
        moduleBCurrentIndex: 0,
        energyPoints: 20,
        evidenceUnlocked: false,
        highlighted: false,
        moduleAResponses: {},
        moduleBResponses: {},
        behavioralLogs: [createLogEntry('test_start', 'Test started')],
        pageBlurCount: 0,
      };
    }

    case actions.SET_PHASE:
      return { ...state, phase: action.payload };

    case actions.SET_MODULE_A_INDEX:
      return {
        ...state,
        moduleACurrentIndex: action.payload,
        evidenceUnlocked: false,
        highlighted: false,
      };

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
      return {
        ...state,
        energyPoints: Math.max(0, state.energyPoints - cost),
      };
    }

    case actions.SET_EVIDENCE_LOCKED:
      return { ...state, evidenceUnlocked: action.payload };

    case actions.SET_HIGHLIGHTED:
      return { ...state, highlighted: action.payload };

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

    case actions.FINISH_TEST: {
      const endTime = new Date().toISOString();
      const scores = runFullScoring(
        state.moduleAQuestions,
        state.moduleAResponses,
        state.moduleBQuestions,
        state.moduleBResponses,
        state.energyPoints
      );
      const logs = [...state.behavioralLogs, createLogEntry('test_complete', 'Test completed')];
      return {
        ...state,
        phase: 'completion',
        endTime,
        results: {
          ...scores,
          subjectId: state.subject.id,
          name: state.subject.name,
          role: state.subject.role,
          formType: 'F',
          formLabel: '正式卷',
          startTime: state.startTime,
          endTime,
          timeUsedSec: Math.round((new Date(endTime) - new Date(state.startTime)) / 1000),
          energyRemaining: state.energyPoints,
          bulkPasteCount: state.bulkPasteCount,
          pageBlurCount: state.pageBlurCount,
          moduleAQuestionsInfo: state.moduleAQuestions,
          moduleBQuestionsInfo: state.moduleBQuestions,
          moduleAResponses: state.moduleAResponses,
          moduleBResponses: state.moduleBResponses,
          behavioralLogs: logs,
        },
        behavioralLogs: logs,
      };
    }

    case actions.ADD_LOG:
      return {
        ...state,
        behavioralLogs: [...state.behavioralLogs, action.payload],
      };

    case actions.ADD_BULK_PASTE: {
      // 防作弊监控：异常大段粘贴（>100 字符），记录长度并计数
      return {
        ...state,
        bulkPasteCount: state.bulkPasteCount + 1,
        behavioralLogs: [
          ...state.behavioralLogs,
          createLogEntry('bulk_paste_detected', '检测到大段文本粘贴', { length: action.payload }),
        ],
      };
    }

    case actions.ADD_PAGE_BLUR: {
      // 防作弊监控：页面失焦（切屏/切窗口）次数统计
      return {
        ...state,
        pageBlurCount: state.pageBlurCount + 1,
        behavioralLogs: [
          ...state.behavioralLogs,
          createLogEntry('page_blur', '检测到页面失焦', { at: action.payload || null }),
        ],
      };
    }

    case actions.ADD_PAGE_BLUR_RETURN: {
      // 切屏回归：记录离开与回归时刻/时长，便于区分"短暂误触"与"长时间离开"
      const p = action.payload || {};
      return {
        ...state,
        behavioralLogs: [
          ...state.behavioralLogs,
          createLogEntry('page_blur_return', '切屏后回到页面', {
            leftAt: p.leftAt || null,
            returnedAt: p.returnedAt || null,
            durationMs: p.durationMs || 0,
          }),
        ],
      };
    }

    case actions.RESET:
      clearState();
      return { ...initialState };

    default:
      return state;
  }
}

const TestContext = createContext(null);
const TestDispatchContext = createContext(null);

export function TestProvider({ children }) {
  const savedState = loadState();
  const [state, dispatch] = useReducer(testReducer, savedState || initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (state.phase !== 'subject-info') {
      saveState(state);
    }
  }, [state]);

  // 防作弊监控：窗口失焦/切屏（仅测中阶段计数）
  // - 去重：Alt+Tab 会同时触发 window.blur 与 visibilitychange(hidden)，800ms 内合并为一次"切屏事件"
  // - 计时：记录每次切屏的离开与回归时刻/时长（page_blur_return），供分析区分"短暂误触"与"长时间离开"
  useEffect(() => {
    const blurStartRef = { current: null };
    const lastBlurLogAtRef = { current: 0 };

    const inTest = () => {
      const s = stateRef.current;
      return s.phase === 'moduleA' || s.phase === 'moduleB' || s.phase === 'completion';
    };

    const onBlur = () => {
      if (!inTest()) return;
      const now = Date.now();
      if (now - lastBlurLogAtRef.current < 800) return; // blur+hidden 双触发去重
      lastBlurLogAtRef.current = now;
      blurStartRef.current = new Date().toISOString();
      dispatch({ type: actions.ADD_PAGE_BLUR, payload: blurStartRef.current });
    };

    const onFocusReturn = () => {
      if (!inTest()) return;
      if (!blurStartRef.current) return;
      const leftAt = blurStartRef.current;
      const returnedAt = new Date().toISOString();
      blurStartRef.current = null;
      dispatch({
        type: actions.ADD_PAGE_BLUR_RETURN,
        payload: { leftAt, returnedAt, durationMs: Math.max(0, Date.now() - new Date(leftAt).getTime()) },
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onBlur();
      else onFocusReturn();
    };

    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocusReturn);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocusReturn);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // 机考锁定：进入测验（模块A/B/完成页）后启用 kiosk 锁，返回首页（RESET）解锁
  useEffect(() => {
    setKioskLock(
      state.phase === 'moduleA' || state.phase === 'moduleB' || state.phase === 'completion'
    );
  }, [state.phase]);

  return (
    <TestContext.Provider value={state}>
      <TestDispatchContext.Provider value={dispatch}>
        {children}
      </TestDispatchContext.Provider>
    </TestContext.Provider>
  );
}

export function useTestState() {
  const ctx = useContext(TestContext);
  if (!ctx) throw new Error('useTestState must be used within TestProvider');
  return ctx;
}

export function useTestDispatch() {
  const ctx = useContext(TestDispatchContext);
  if (!ctx) throw new Error('useTestDispatch must be used within TestProvider');
  return ctx;
}

export function useTestActions() {
  const dispatch = useTestDispatch();
  const state = useTestState();

  const setSubject = useCallback((s) => {
    dispatch({ type: actions.SET_SUBJECT, payload: s });
  }, [dispatch]);

  const startTest = useCallback(() => {
    dispatch({ type: actions.START_TEST });
  }, [dispatch]);

  const setPhase = useCallback((p) => {
    dispatch({ type: actions.SET_PHASE, payload: p });
  }, [dispatch]);

  const updateModuleAResponse = useCallback((questionId, data) => {
    dispatch({ type: actions.UPDATE_MODULE_A_RESPONSE, payload: { questionId, data } });
  }, [dispatch]);

  const consumeEnergy = useCallback((cost, actionName, questionId) => {
    dispatch({ type: actions.CONSUME_ENERGY, payload: cost });
    dispatch({
      type: actions.ADD_LOG,
      payload: createLogEntry(actionName || 'energy_consumed', `Cost: ${cost}`, {
        energyCost: cost,
        questionId: questionId || null,
      }),
    });
  }, [dispatch]);

  const setEvidenceUnlocked = useCallback((val) => {
    dispatch({ type: actions.SET_EVIDENCE_LOCKED, payload: val });
  }, [dispatch]);

  const setHighlighted = useCallback((val) => {
    dispatch({ type: actions.SET_HIGHLIGHTED, payload: val });
  }, [dispatch]);

  const updateModuleBResponse = useCallback((questionId, data) => {
    dispatch({ type: actions.UPDATE_MODULE_B_RESPONSE, payload: { questionId, data } });
  }, [dispatch]);

  const goToNextModuleA = useCallback(() => {
    if (state.moduleACurrentIndex < state.moduleAQuestions.length - 1) {
      dispatch({ type: actions.SET_MODULE_A_INDEX, payload: state.moduleACurrentIndex + 1 });
    } else {
      dispatch({ type: actions.SET_PHASE, payload: 'moduleB' });
      dispatch({
        type: actions.ADD_LOG,
        payload: createLogEntry('moduleB_start', 'Module B started'),
      });
    }
  }, [state.moduleACurrentIndex, state.moduleAQuestions.length, dispatch]);

  const goToNextModuleB = useCallback(() => {
    if (state.moduleBCurrentIndex < state.moduleBQuestions.length - 1) {
      dispatch({ type: actions.SET_MODULE_B_INDEX, payload: state.moduleBCurrentIndex + 1 });
    } else {
      dispatch({ type: actions.FINISH_TEST });
    }
  }, [state.moduleBCurrentIndex, state.moduleBQuestions.length, dispatch]);

  const finishTest = useCallback(() => {
    dispatch({ type: actions.FINISH_TEST });
  }, [dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: actions.RESET });
  }, [dispatch]);

  // 防作弊监控：异常大段粘贴（>100 字符）
  const addBulkPaste = useCallback((length) => {
    dispatch({ type: actions.ADD_BULK_PASTE, payload: length });
  }, [dispatch]);

  // 防作弊监控：页面失焦计数（由 TestProvider 全局监听调用）
  const addPageBlur = useCallback(() => {
    dispatch({ type: actions.ADD_PAGE_BLUR });
  }, [dispatch]);

  return {
    setSubject, startTest, setPhase,
    updateModuleAResponse, consumeEnergy,
    setEvidenceUnlocked, setHighlighted,
    updateModuleBResponse,
    goToNextModuleA, goToNextModuleB, finishTest, reset,
    addBulkPaste, addPageBlur,
  };
}
