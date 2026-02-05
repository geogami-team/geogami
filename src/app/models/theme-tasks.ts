import { QuestionType, AnswerType, TaskMode } from './types';

export const themetasks: ReadonlyArray<any> = [
    {
        name: 'Tasktypes.selfLocation',
        type: 'theme-loc',
        // category: "themeSelfLocalization",
        category: 'theme',
        question: {
            type: QuestionType.TEXT,
            key: 'QuestionText.whereAreYouNow',
            text: ''    // empty text will be replaced by the translation
        },
        answer: {
            type: AnswerType.MAP_POINT
        },
        evaluate: 'evalDistanceToPoint',
        settings: {}
    },
    {
        name: 'Tasktypes.objectLocation',
        type: 'theme-object',
        // category: "themeobjectLocalization",
        category: 'theme',
        question: {
            type: QuestionType.MAP_FEATURE,
            key: 'QuestionText.findTheHouseChoosePhoto',
            text: ''    // empty text will be replaced by the translation
        },
        answer: {
            type: AnswerType.MULTIPLE_CHOICE
        },
        evaluate: 'evalMultipleChoice',
        settings: {}
    }, {
        name: 'Tasktypes.objectLocation',
        type: 'theme-object',
        // category: "themeobjectLocalization",
        category: 'theme',
        question: {
            type: QuestionType.MAP_FEATURE,
            key: 'QuestionText.findTheHouseTakePhoto',
            text: ''    // empty text will be replaced by the translation
        },
        answer: {
            type: AnswerType.PHOTO
        },
        evaluate: 'evalNone',
        settings: {}
    }, {
        name: 'Tasktypes.objectLocation',
        type: 'theme-object',
        // category: "themeobjectLocalization",
        category: 'theme',
        questionType: 'textPhoto',
        question: {
            type: QuestionType.MAP_FEATURE_PHOTO,
            key: 'QuestionText.lookForTheHouse',
            text: ''    // empty text will be replaced by the translation
        },
        answer: {
            type: AnswerType.MAP_POINT
        },
        evaluate: 'evalPointInPolygon',
        settings: {}
    }, {
        name: 'Tasktypes.objectLocation',
        type: 'theme-object',
        // category: "themeobjectLocalization",
        category: 'theme',
        questionType: 'text',
        question: {
            type: QuestionType.TEXT,
            key: 'QuestionText.lookForSThingTap',
            text: '',    // empty text will be replaced by the translation
            mode: TaskMode.NO_FEATURE
        },
        answerType: 'mapPoint',
        answer: {
            type: AnswerType.MAP_POINT,
            mode: TaskMode.NO_FEATURE
        },
        evaluate: 'evalPointInPolygon',
        settings: {}
    }, {
        name: 'Tasktypes.objectLocation',
        type: 'theme-object',
        // category: "themeobjectLocalization",
        category: 'theme',
        questionType: 'text',
        question: {
            type: QuestionType.TEXT,
            key: 'QuestionText.lookForSThingChoosePhoto',
            text: ''    // empty text will be replaced by the translation

        },
        answerType: 'multipleChoice',
        answer: {
            type: AnswerType.MULTIPLE_CHOICE
        },
        evaluate: 'evalMultipleChoice',
        settings: {}
    }, {
        name: 'Tasktypes.objectLocation',
        type: 'theme-object',
        // category: "themeobjectLocalization",
        category: 'theme',
        questionType: 'text',
        question: {
            type: QuestionType.TEXT,
            key: 'QuestionText.lookForSThingTakePhoto',
            text: ''    // empty text will be replaced by the translation
        },
        answerType: 'photo',
        answer: {
            type: AnswerType.PHOTO
        },
        evaluate: 'evalNone',
        settings: {}
    },
    {
        name: 'Tasktypes.directionDetermination',
        type: 'theme-direction',
        // category: "themedirection",
        category: 'theme',
        questionType: 'textMapFeature',
        question: {
            type: QuestionType.MAP_DIRECTION_MARKER,
            key: 'QuestionText.turnDirectionChoosePhoto',
            text: ''    // empty text will be replaced by the translation
        },
        answerType: 'multipleChoice',
        answer: {
            type: AnswerType.MULTIPLE_CHOICE
        },
        evaluate: 'evalMultipleChoice',
        settings: {}
    }, {
        name: 'Tasktypes.directionDetermination',
        type: 'theme-direction',
        // category: "themedirection",
        category: 'theme',
        questionType: 'textMapFeature',
        question: {
            type: QuestionType.MAP_DIRECTION_MARKER,
            key: 'QuestionText.turnDirectionMapBased',
            text: ''    // empty text will be replaced by the translation
        },
        answerType: 'direction',
        answer: {
            type: AnswerType.DIRECTION
        },
        evaluate: 'evalDirection',
        settings: {}
    }, {
        name: 'Tasktypes.directionDetermination',
        type: 'theme-direction',
        // category: "themedirection",
        category: 'theme',
        questionType: 'textOrientation',
        question: {
            type: QuestionType.MAP_DIRECTION,
            // text: 'Drehe dich, bis die Pfeile in die gleiche Richtung zeigen.',
            key: 'QuestionText.turnDirectionArrow',
            text: ''    // empty text will be replaced by the translation
        },
        answerType: 'direction',
        answer: {
            type: AnswerType.DIRECTION,
            mode: TaskMode.DIRECTION_ARROW,
        },
        evaluate: 'evalDirection',
        settings: {}
    }, {
        name: 'Tasktypes.directionDetermination',
        type: 'theme-direction',
        // category: "themedirection",
        category: 'theme',
        questionType: 'text',
        question: {
            type: QuestionType.TEXT,
            key: 'QuestionText.whereAreYouLooking',
            text: ''    // empty text will be replaced by the translation
        },
        answer: {
            type: AnswerType.MAP_DIRECTION,
        },
        answerType: 'mapDirection',
        evaluate: 'evalMapDirection',
        settings: {}
    }, {
        name: 'Tasktypes.directionDetermination',
        type: 'theme-direction',
        // category: "themedirection",
        category: 'theme',
        questionType: 'textPhoto',
        question: {
            type: QuestionType.MAP_DIRECTION_PHOTO,
            key: 'QuestionText.turnDirectionPhoto',
            text: ''    // empty text will be replaced by the translation

        },
        answerType: 'mapDirection',
        answer: {
            type: AnswerType.MAP_DIRECTION,
        },
        evaluate: 'evalMapDirection',
        settings: {}
    }, { // New task type with photo answer for direction determination
        name: 'Tasktypes.directionDetermination',
        type: 'theme-direction',
        // category: "themedirection",
        category: 'theme',
        questionType: 'textPhoto',
        question: {
            type: QuestionType.MAP_DIRECTION_PHOTO,
            key: 'QuestionText.turnDirectionPhotoBased',
            text: ''    // empty text will be replaced by the translation

        },
        answerType: 'direction',
        answer: {
            type: AnswerType.DIRECTION,
        },
        evaluate: 'evalDirection',
        settings: {}
    }
];