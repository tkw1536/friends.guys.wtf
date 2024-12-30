import * as React from "react"
import styles from "./index.module.css"
import moment from "moment-timezone"
import Head from "next/head"


type Friend = {
    name: string;
    location: string;
    tz: string;
    focus?: boolean;
}


/** isFriendArray checks if v is an array of friends */
function isFriendArray(v: any): v is Friend[] {
    return Array.isArray(v) && v.reduce((prev: boolean, current: any) => prev && isFriend(current), true)
}

/** isFriend checks if v is a friend */
function isFriend(v: any): v is Friend {
    const keys = new Set(Object.keys(v))

    return (
        // we have an object
        (Object.getPrototypeOf(v) === Object.prototype) &&

        // with three or four keys
        (keys.size === 3 || keys.size === 4) &&

        // the focus key being a boolean (if set)
        (keys.size === 3 || keys.has('focus')) &&
        (keys.size === 3 || typeof v['focus'] === 'boolean') &&

        // and the required keys
        (typeof v['name'] === 'string') &&
        (typeof v['location'] === 'string') &&
        (typeof v['tz'] === 'string')
    );
}


type FriendState = {
    index: number;
    offset: number;
    tzName: string;

    time: moment.Moment;

    midnight: moment.Moment;
    countdown: moment.Duration;
} & Friend;

type FriendsEditableProps = FriendsTableProps & {
    onReset: () => void;
    onSave: (friends: Friend[]) => void;
}
type FriendsTableProps = {
    Friends: Friend[];
    message?: string;
}

type FriendsTableState = {
    Friends: FriendState[];
    Initial: boolean;
}

type FriendsEditableState = {
    ShowMessage: boolean;
    Editable: boolean;
    Error: string;
    Friends: Friend[];
}

type FriendsLoaderState = {'key': number} & ({'state': 'loading', message: null, data: null } | { 'state': 'loaded', message: null, data: Friend[] } | { 'state': 'error', message: string, data: Friend[] })

const FRIENDS_KEY = 'friends';

export default class FriendsLoader extends React.Component<{}, FriendsLoaderState> {
    state: FriendsLoaderState = { 'key': 0, 'state': 'loading', data: null, message: null }

    componentDidMount(): void {
        let data: Friend[]
        let message: string | null = null;
        try {
            data = this.loadFriends()
        } catch(e: unknown) {
            data = this.loadDefault()
            message = (e as Error).message;
        }

        this.setState(message === null ? { 'state': 'loaded', data, message } : { 'state': 'error', message, data })
    }

    private loadDefault = (): Friend[] => {
        return [
            { name: "Me", location: "Here", tz: "Europe/Berlin", focus: true },
        ]
    }

    private loadFriends = (): Friend[] => {
        let friendsString = null;
        try {
            friendsString = localStorage.getItem(FRIENDS_KEY);
        } catch (e: unknown) {
            throw new Error('localStorage not available');
        }

        if (friendsString === null) {
            throw new Error('no friends in local storage');
        }

        let friendsJSON: any = null;
        try {
            friendsJSON = JSON.parse(friendsString);
        } catch(e: unknown) {
            throw new Error('invalid friends data: unable to parse JSON');
        }

        if (!isFriendArray(friendsJSON)) {
            throw new Error('invalid friends data: not an array of friends');
        }
        return friendsJSON;
    }

    private resetFriends = () => {
        this.setState(({ key }) => ({ 'key': key + 1, 'state': 'loaded', data: this.loadDefault(), message: null }))
        try {
            window.localStorage.removeItem(FRIENDS_KEY);
        } catch(e: unknown) {
        } 
    }

    private storeFriends = (friends: Friend[]): void => {
        try {
            window.localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends));
        } catch(e: unknown) {
            throw new Error('unable to store friends')
        }   
    }
    
    render(): React.ReactNode {
        const state = this.state;
        return <div className={styles.centered}>
            <Head><title>Friends</title></Head>
            <h1>
                Time For All My Friends
            </h1>
            <p>
                This site shows you a countdown to the next day for all your friends. 
                Intended to wish them a happy new year. 
            </p>
            { state.state === 'loaded' && <FriendsEditable key={state.key} Friends={state.data} onReset={this.resetFriends} onSave={this.storeFriends} />}
            { state.state === 'error' && <FriendsEditable key={state.key} Friends={state.data} onReset={this.resetFriends} onSave={this.storeFriends} message={"Error: " + state.message + "; loaded default instead"} />}

            <footer>
                <p>
                    This site is intended for technical users only.
                    Editing requires manually fiddling with the JSON.
                    The properties <em>name</em>, <em>location</em>, <em>TZ</em> must be strings. <em>focus</em> is an optional boolean. 
                    Hitting save stores your friends list in local storage. 
                </p>
                <p>
                    For legal reasons I must link <a href="https://inform.everyone.wtf" target="_blank">my Privacy Policy and Imprint</a>. 
                </p>
            </footer>
        </div>
    }
}

class FriendsEditable extends React.Component<FriendsEditableProps, FriendsEditableState> {
    state: FriendsEditableState = {
        ShowMessage: true,
        Editable: false,
        Error: "",
        Friends: this.props.Friends,
    }
    private toggleEditable = () => {
        this.setState(({ Editable, Friends }): FriendsEditableState => {
            // toggle editable
            if (!Editable) return { ShowMessage: false, Editable: true, Error: "", Friends }
            
            const value = this.textarea.current!.value;
            const result = FriendsEditable.tryParse(value)

            if (typeof result === 'string') return { ShowMessage: false, Editable: true, Error: result, Friends }


            this.onSave(result);
            return { ShowMessage: false, Editable: false, Error: "", Friends: result }
        })
    }
    private static tryParse(value: string): Friend[] | string {
        let parsed: any = null
        try {
            parsed = JSON.parse(value)
        } catch (e: any) {
            return "JSON: " + e.toString()
        }

        if (isFriendArray(parsed)) return parsed
        return "Not a valid friend"
    }

    private onReset: React.EventHandler<React.SyntheticEvent<HTMLButtonElement, MouseEvent>> = (evt) => {
        if (evt.currentTarget.disabled) {
            return;
        }

        const { onReset } = this.props;
        if (typeof onReset !== 'function') return
        onReset();
        this.setState({ Error: "Reset To Default" })
    }

    private onSave = (friends: Friend[]) => {
        const { onSave } = this.props;
        if (typeof onSave !== 'function') return;

        try {
            onSave(friends);
        } catch(e: unknown) {
            this.setState({ Error: e.toString() })
        }
    }

    private textarea = React.createRef<HTMLTextAreaElement>()
    render() {
        const { Friends, Editable, Error, ShowMessage } = this.state;
        const { message } = this.props
        const json = JSON.stringify(Friends, null, '  ')
        const rows = json.split("\n").length

        return <>
            <div>
                <FriendsTable Friends={Friends} />
            </div>

            <div className={styles.editable}>
                <button onClick={this.toggleEditable}>
                    {Editable ? "Save" : "Edit"}
                </button>
                <button onClick={this.onReset} disabled={Editable}>
                    Reset
                </button>
                {ShowMessage && typeof message === 'string' && <p>{ message }</p>}
                { Error && <p>{Error}</p>}
                { Editable && <div>
                    <textarea ref={this.textarea} rows={rows}>{json}</textarea>
                </div>}
            </div>
        </>;
    }
}

class FriendsTable extends React.Component<FriendsTableProps, FriendsTableState> {
    state: FriendsTableState = {
        Friends: [],
        Initial: true,
    }
    private refreshFriends(props: FriendsTableProps) {
        const Initial = false

        // get the local timezone
        const now = moment()
        const here = moment.tz.guess()

        // sort friends by timezone
        const Friends = props.Friends.map((f, index) => {
            const time = moment().tz(f.tz)
            const offset = time.utcOffset()
            const tzName = time.tz();

            // get the next midnight
            const midnight =
                moment().tz(f.tz)
                    .add(moment.duration(1, 'days'))
                    .hours(0)
                    .minutes(0)
                    .seconds(0)
                    .tz(here)

            const countdown = moment.duration(midnight.diff(now))

            return { ...f, index, offset, time, midnight, tzName, countdown };
        });
        Friends.sort((a, b) => (b.offset - a.offset) || (a.index - b.index))

        // and set the state!
        this.setState({ Friends, Initial })
    }

    private intervalID: number | null = null;
    private static updateIntervalMs = 1000
    componentDidMount(): void {
        this.refreshFriends(this.props)
        this.intervalID = setInterval(() => this.refreshFriends(this.props), FriendsTable.updateIntervalMs) as unknown as number
    }
    componentWillUnmount(): void {
        if (this.intervalID === null) return
        clearInterval(this.intervalID)
        this.intervalID = null
    }
    componentDidUpdate(prevProps: Readonly<FriendsTableProps>, prevState: Readonly<FriendsTableState>, snapshot?: any): void {
        if (prevProps.Friends !== this.props.Friends) {
            this.refreshFriends(this.props)
        }
    }
    render() {
        const { Friends, Initial } = this.state;
        if (Initial) return null;
        return <table>
            <thead>
                <tr>
                    <th>
                        Name
                    </th>
                    <th>
                        Location
                    </th>
                    <th>
                        TZ
                    </th>
                    <th>
                        Current Time
                    </th>
                    <th>
                        Next Day (Local)
                    </th>
                    <th>
                        Countdown
                    </th>
                </tr>
            </thead>
            <tbody>
                {Friends.map((f, i) => <FriendDisplay friend={f} key={f.name} prevOffset={Friends[i - 1]?.offset} />)}
            </tbody>
        </table>
    }
}

class FriendDisplay extends React.Component<{ friend: FriendState, prevOffset?: number }> {
    render() {
        const { friend: { name, location, time, offset, tzName, midnight, countdown, focus }, prevOffset } = this.props;
        const border = prevOffset === offset ? "" : styles.border
        return <tr className={(focus ? styles.bold : "") + " " + border}>
            <td>{name}</td>
            <td>{location}</td>
            <td>{tzName}</td>
            <td>{time.format('YYYY-MM-DD HH:mm:ss')}</td>
            <td>{midnight.format('YYYY-MM-DD HH:mm:ss')}</td>
            <td>{fn(countdown.get("hours"), 2)}:{fn(countdown.get("minutes"), 2)}:{fn(countdown.get("seconds"), 2)}</td>
        </tr>
    }
}

function fn(v: number, d: number): string {
    let number = v.toString()
    while (number.length < d) {
        number = '0' + number
    }
    return number
}
