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

module.exports = { getRightTicketType, getTicketTypeForSession };
