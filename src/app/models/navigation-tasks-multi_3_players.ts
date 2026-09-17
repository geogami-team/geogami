import { QuestionType, AnswerType, TaskMode } from './types';
import { multiplayerExplorationTask } from './navigation-tasks';


export const navtasksMultiplayers3: ReadonlyArray<any> = [
    {
        category: 'nav',
        type: 'nav-flag',
        //name: 'Navigation zur Zielfahne',
        name: 'Tasktypes.navigationToFlag',
        question: [
            {
                type: QuestionType.TEXT,
                key: 'QuestionText.goToFlag',
                text: ''    // empty text will be replaced by the translation
            },
            {
                type: QuestionType.TEXT,
                key: 'QuestionText.goToFlag',
                text: ''    // empty text will be replaced by the translation
            },
            {
                type: QuestionType.TEXT,
                key: 'QuestionText.goToFlag',
                text: ''    // empty text will be replaced by the translation
            }
        ],
        answer: [
            {
                type: AnswerType.POSITION,
                position: undefined
            },
            {
                type: AnswerType.POSITION,
                position: undefined
            },
            {
                type: AnswerType.POSITION,
                position: undefined
            }
        ],
        evaluate: 'distanceToPoint',
        settings: {}
    }, {
        category: 'nav',
        type: 'nav-arrow',
        //name: 'Navigation mit Richtungspfeil',
        name: 'Tasktypes.navigationWithArrow',
        question: [
            {
                type: QuestionType.TEXT,
                key: 'QuestionText.followTheArrow',
                text: ''    // empty text will be replaced by the translation
            },
            {
                type: QuestionType.TEXT,
                key: 'QuestionText.followTheArrow',
                text: ''    // empty text will be replaced by the translation
            },
            {
                type: QuestionType.TEXT,
                key: 'QuestionText.followTheArrow',
                text: ''    // empty text will be replaced by the translation
            }
        ],
        answer: [
            {
                type: AnswerType.POSITION,
                mode: TaskMode.NAV_ARROW,
                position: undefined
            },
            {
                type: AnswerType.POSITION,
                mode: TaskMode.NAV_ARROW,
                position: undefined
            },
            {
                type: AnswerType.POSITION,
                mode: TaskMode.NAV_ARROW,
                position: undefined
            }
        ],
        evaluate: 'distanceToPoint',
        settings: {}
    }, {
        category: 'nav',
        type: 'nav-text',
        //name: 'Navigation mit Textanweisung',
        name: 'Tasktypes.navigationViaText',
        question: [
            {
                type: QuestionType.NAV_INSTRUCTION,
                text: ''
            },
            {
                type: QuestionType.NAV_INSTRUCTION,
                text: ''
            },
            {
                type: QuestionType.NAV_INSTRUCTION,
                text: ''
            }
        ],
        answer: [
            {
                type: AnswerType.POSITION,
                position: undefined
            },
            {
                type: AnswerType.POSITION,
                position: undefined
            },
            {
                type: AnswerType.POSITION,
                position: undefined
            }
        ],
        evaluate: 'distanceToPoint',
        settings: {}
    }, {
        category: 'nav',
        type: 'nav-photo',
        //name: 'Navigation mit Foto',
        name: 'Tasktypes.navigationViaPhoto',
        question: [
            {
                type: QuestionType.NAV_INSTRUCTION_PHOTO,
                key: 'QuestionText.goToPlace',
                text: ''    // empty text will be replaced by the translation
            },
            {
                type: QuestionType.NAV_INSTRUCTION_PHOTO,
                key: 'QuestionText.goToPlace',
                text: ''    // empty text will be replaced by the translation
            },
            {
                type: QuestionType.NAV_INSTRUCTION_PHOTO,
                key: 'QuestionText.goToPlace',
                text: ''    // empty text will be replaced by the translation
            }
        ],
        answer: [
            {
                type: AnswerType.POSITION,
                position: undefined
            },
            {
                type: AnswerType.POSITION,
                position: undefined
            },
            {
                type: AnswerType.POSITION,
                position: undefined
            }
        ],
        evaluate: 'distanceToPoint',
        settings: {}
    }, multiplayerExplorationTask(3)
];
