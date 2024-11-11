const getRightTicketType = (ticketType) => {
    if (ticketType !== 'VS') {
        return 'TS';
    } else {
        return 'VS';
    }
};

const getTicketTypeForSession = (ticketType) => {
    if (ticketType === 'TS') {
        return ['TSY', 'TSF', 'GR'];
    } else {
        return ['VS'];
    }
};

const getTranslatedTicketType = (ticketType) => {
    switch (ticketType) {
        case 'TSF':
            return 'ТСФ';
        case 'TSY':
            return 'ТСЮ';
        case 'GR':
            return 'ГР';
        case 'VS':
            return 'ВС';
        default:
            return 'Неизвестный тип';
    }
};

module.exports = {
    getRightTicketType,
    getTicketTypeForSession,
    getTranslatedTicketType,
};
