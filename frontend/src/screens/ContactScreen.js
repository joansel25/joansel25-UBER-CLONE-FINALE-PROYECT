import React,{useState} from 'react';
import {View,Text,TextInput,Alert,Button} from 'react-native';

export default function ContactScreen(){

const [phone,setPhone]=useState('');
const [email,setEmail]=useState('');

const validateEmail=()=>{

if(!email.includes('@') || !email.includes('.com')){
 Alert.alert('Correo inválido');
 return;
}

Alert.alert('Correcto');
};

return(
<View>

<Text>Phone</Text>
<TextInput
keyboardType="numeric"
value={phone}
onChangeText={setPhone}
/>

<Text>Email</Text>
<TextInput
value={email}
onChangeText={setEmail}
/>

<Button
title="Validate"
onPress={validateEmail}
/>

</View>
);
}