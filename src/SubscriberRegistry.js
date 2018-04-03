/**
 * @hideconstructor
 */
export default class SubscriberRegistry {
    constructor(configuration) {
        this._holder = [];
        for (const topic in configuration.subscribers) {
            if (!configuration.subscribers.hasOwnProperty(topic)) {
                continue;
            }

            for (const subscriber of configuration.subscribers[topic]) {
                this.subscribe(topic, subscriber);
            }
        }
    }

    subscribersFor(topic) {
        return this._holder
            .filter(it => topic === it.topic)
            .map(it => it.consumer);
    }

    subscribe(topic, consumer) {
        if (-1 < this.indexOf(topic, consumer)) {
            return;
        }

        this._holder.push({topic, consumer});
    }

    unsubscribe(topic, consumer) {
        const index = this._indexOf(topic, consumer);
        if (-1 === index) {
            return;
        }

        this._holder.splice(index, 1);
    }

    indexOf(topic, consumer) {
        return this._holder.findIndex(it => topic === it.topic && consumer === it.consumer);
    }

    getKnownTopics() {
        const knownTopics = [];

        this._holder.map(it => it.topic)
            .filter(it => -1 === knownTopics.indexOf(it))
            .forEach(it => knownTopics.push(it));

        return knownTopics;
    }
}
